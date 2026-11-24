<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $table = config('vibuilder.table_prefix', 'vb_').'documents';

        if (Schema::hasTable($table)) {
            return;
        }

        Schema::create($table, function (Blueprint $table) {
            $table->id();
            $table->nullableMorphs('documentable');
            $table->string('key', 64)->default('default');
            $table->json('content');
            $table->char('revision', 64);
            $table->timestamps();
            $table->unique(['documentable_type', 'documentable_id', 'key']);
        });
    }

    // Intentionally does not drop the table: content must not be lost by rollback.
    public function down(): void
    {
    }
};
