<?php

declare(strict_types=1);

namespace Vibuilder\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Vibuilder\Media\ChunkStore;
use Vibuilder\Media\ImageInspector;
use Vibuilder\Media\UploadException;

final class ChunkStoreTest extends TestCase
{
    private const ID = 'abcdefghijklmnop1234';
    private string $dir;

    private function store(int $chunk = 4, int $max = 100): ChunkStore
    {
        $this->dir = sys_get_temp_dir().'/vb-chunks-'.bin2hex(random_bytes(4));

        return new ChunkStore($this->dir, $chunk, $max);
    }

    private function fails(callable $fn): bool
    {
        try {
            $fn();
        } catch (UploadException) {
            return true;
        }

        return false;
    }

    public function test_assembles_chunks_in_any_order(): void
    {
        $s = $this->store();
        $data = '0123456789'; // 10 bytes => chunks of 4,4,2
        $s->put(self::ID, 2, 'a.png', 10, '89');
        $s->put(self::ID, 0, 'a.png', 10, '0123');
        $this->assertSame([0, 2], $s->received(self::ID));
        $s->put(self::ID, 1, 'a.png', 10, '4567');
        $file = $s->assemble(self::ID);
        $this->assertSame($data, file_get_contents($file['path']));
        $this->assertSame('a.png', $file['name']);
        $s->forget(self::ID);
        $this->assertFalse(is_dir($this->dir.'/'.self::ID));
    }

    public function test_rejects_wrong_chunk_sizes_and_indexes(): void
    {
        $s = $this->store();
        $this->assertTrue($this->fails(fn () => $s->put(self::ID, 0, 'a', 10, '012')), 'short chunk');
        $this->assertTrue($this->fails(fn () => $s->put(self::ID, 0, 'a', 10, '01234')), 'long chunk');
        $this->assertTrue($this->fails(fn () => $s->put(self::ID, 2, 'a', 10, '0123')), 'last chunk wrong length');
        $this->assertTrue($this->fails(fn () => $s->put(self::ID, 3, 'a', 10, '01')), 'index out of range');
        $this->assertTrue($this->fails(fn () => $s->put(self::ID, 0, 'a', 1000, '0123')), 'over max size');
    }

    public function test_rejects_missing_chunks_and_bad_ids(): void
    {
        $s = $this->store();
        $s->put(self::ID, 0, 'a', 10, '0123');
        $this->assertTrue($this->fails(fn () => $s->assemble(self::ID)), 'missing chunks');
        $this->assertTrue($this->fails(fn () => $s->put('../etc', 0, 'a', 10, '0123')), 'path traversal id');
        $this->assertTrue($this->fails(fn () => $s->put(self::ID, 0, 'a', 12, '0123')), 'size mismatch for same id');
    }

    public function test_sanitizes_file_name(): void
    {
        $s = $this->store();
        $s->put(self::ID, 0, '../../evil<>.php', 4, '0123');
        $this->assertSame('evil.php', $s->assemble(self::ID)['name']);
    }

    public function test_purges_only_stale_uploads(): void
    {
        $s = $this->store();
        $s->put(self::ID, 0, 'a', 4, '0123');
        $this->assertSame(0, $s->purgeOlderThan(3600));
        $this->assertSame(1, $s->purgeOlderThan(3600, time() + 7200));
    }

    public function test_image_inspector(): void
    {
        $png = sys_get_temp_dir().'/vb-'.bin2hex(random_bytes(4)).'.png';
        file_put_contents($png, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='));
        $info = (new ImageInspector())->inspect($png);
        $this->assertSame('png', $info['extension']);
        $this->assertTrue($this->fails(fn () => (new ImageInspector(maxSide: 0))->inspect($png)), 'too large');

        $fake = sys_get_temp_dir().'/vb-'.bin2hex(random_bytes(4)).'.jpg';
        file_put_contents($fake, '<?php echo 1;');
        $this->assertTrue($this->fails(fn () => (new ImageInspector())->inspect($fake)), 'not an image');
    }
}
