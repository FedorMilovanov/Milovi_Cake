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
        (self.root / 'clip.webm').write_bytes(b'webm fixture')
        (self.root / 'clip.mp4').write_bytes(b'\x00\x00\x00\x18ftypisom' + b'video bytes' * 40)
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

    def test_video_byte_ranges_and_suffix_seeking(self):
        media = (self.root / 'clip.mp4').read_bytes()
        for name, expected, header, start, end in [
            ('head', b'', None, None, None),
            ('prefix', media[:24], 'bytes=0-23', 0, 23),
            ('suffix', media[-8:], 'bytes=-8', len(media)-8, len(media)-1),
            ('open', media[24:], 'bytes=24-', 24, len(media)-1),
        ]:
            headers = {'Range': header} if header else {}
            method = 'HEAD' if name == 'head' else 'GET'
            req = urllib.request.Request(self.url+'/clip.mp4', headers=headers, method=method)
            with urllib.request.urlopen(req) as response:
                self.assertEqual(response.headers.get_content_type(), 'video/mp4')
                self.assertEqual(response.headers['Accept-Ranges'], 'bytes')
                self.assertEqual(response.read(), expected)
                self.assertEqual(response.status, 200 if name == 'head' else 206)
                if start is not None:
                    self.assertEqual(response.headers['Content-Range'], f'bytes {start}-{end}/{len(media)}')

    def test_invalid_video_range_fails_closed_with_416(self):
        req = urllib.request.Request(self.url+'/clip.webm', headers={'Range':'bytes=999999-'})
        with self.assertRaises(urllib.error.HTTPError) as caught:
            urllib.request.urlopen(req)
        self.assertEqual(caught.exception.code, 416)
        self.assertEqual(caught.exception.headers['Content-Range'], 'bytes */12')

    def test_shared_path_prefix_does_not_allow_a_sibling_directory(self):
        with self.assertRaises(urllib.error.HTTPError) as caught:
            urllib.request.urlopen(self.url + '/%2e%2e/site-neighbor/private.txt')
        self.assertEqual(caught.exception.code, 404)


if __name__ == '__main__':
    unittest.main()
