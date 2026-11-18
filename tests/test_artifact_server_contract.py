import functools
import gzip
from pathlib import Path
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from serve_pages_artifact import ArtifactHandler, ReusableServer


class ArtifactServerContractTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        parent = Path(self.temp.name)
        self.root = parent / 'site'
        self.root.mkdir()
        self.html = b'<!doctype html><html>' + b'unchanged text ' * 100 + b'</html>'
        (self.root / 'index.html').write_bytes(self.html)
        self.not_found_html = (b'<!doctype html><html lang="ru"><title>404</title>'
                               + b'<main>Page not found. </main>' * 65 + b'</html>')
        (self.root / '404.html').write_bytes(self.not_found_html)
        (self.root / 'clip.webm').write_bytes(b'webm fixture')
        sibling = parent / 'site-neighbor'
        sibling.mkdir()
        (sibling / 'private.txt').write_text('not in the served root')
        self.server = ReusableServer(('127.0.0.1', 0), functools.partial(ArtifactHandler, root=self.root))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f'http://127.0.0.1:{self.server.server_address[1]}'

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def test_repeated_gzip_responses_preserve_the_exact_payload(self):
        for _ in range(2):
            request = urllib.request.Request(self.url + '/', headers={'Accept-Encoding': 'gzip'})
            with urllib.request.urlopen(request) as response:
                self.assertEqual(response.headers['Content-Encoding'], 'gzip')
                self.assertEqual(gzip.decompress(response.read()), self.html)

    def test_webm_is_served_as_video(self):
        with urllib.request.urlopen(self.url + '/clip.webm') as response:
            self.assertEqual(response.headers.get_content_type(), 'video/webm')
            self.assertEqual(response.read(), b'webm fixture')

    def test_missing_url_serves_real_404_html_with_correct_status(self):
        for method in ('GET', 'HEAD'):
            req = urllib.request.Request(self.url + '/missing-cake/', method=method,
                                         headers={'Accept-Encoding': 'gzip'})
            with self.assertRaises(urllib.error.HTTPError) as caught:
                urllib.request.urlopen(req)
            response = caught.exception
            self.assertEqual(response.code, 404)
            self.assertEqual(response.headers.get_content_type(), 'text/html')
            self.assertEqual(response.headers['Content-Encoding'], 'gzip')
            self.assertEqual(response.headers['Cache-Control'], 'no-cache')
            body = response.read()
            if method == 'GET':
                self.assertEqual(gzip.decompress(body), self.not_found_html)
            else:
                self.assertEqual(body, b'')

    def test_missing_url_falls_back_to_plain_404_if_error_page_absent(self):
        (self.root / '404.html').unlink()
        with self.assertRaises(urllib.error.HTTPError) as caught:
            urllib.request.urlopen(self.url + '/missing-cake/')
        self.assertEqual(caught.exception.code, 404)
        self.assertEqual(caught.exception.headers.get_content_type(), 'text/plain')
        self.assertEqual(caught.exception.read(), b'not found')

    def test_shared_path_prefix_does_not_allow_a_sibling_directory(self):
        with self.assertRaises(urllib.error.HTTPError) as caught:
            urllib.request.urlopen(self.url + '/%2e%2e/site-neighbor/private.txt')
        self.assertEqual(caught.exception.code, 404)


if __name__ == '__main__':
    unittest.main()
