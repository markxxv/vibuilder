<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>{{ $config['title'] }} · Page builder</title>
    <link rel="stylesheet" href="{{ route('vibuilder.asset', ['file' => 'vibuilder-editor.css']) }}?v={{ $version }}">
    <style>html, body { margin: 0; height: 100%; overflow: hidden; }</style>
</head>
<body>
<div id="vibuilder"></div>
<script src="{{ route('vibuilder.asset', ['file' => 'vibuilder-editor.js']) }}?v={{ $version }}"></script>
<script>
    (function () {
        var props = @json($config);
        Vibuilder.mount({
            host: document.getElementById('vibuilder'),
            props: props,
            utilities: {
                save: function (document, revision) {
                    return fetch(@json($saveUrl), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': props.csrfToken },
                        body: JSON.stringify({ document: document, revision: revision }),
                    }).then(function (response) {
                        return response.json().catch(function () { return {}; }).then(function (body) {
                            if (response.ok && body.ok) return { ok: true, revision: body.revision };
                            var message = body.message || (response.status === 419 ? 'Session expired. Reload the page.' : 'Could not save (HTTP ' + response.status + ').');
                            return { ok: false, message: message };
                        });
                    });
                },
            },
        });
    })();
</script>
</body>
</html>
