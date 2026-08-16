# XSS Fixture

<script>window.__xssRan = true;</script>

<img src=x onerror="window.__xssImg = true">

<a href="javascript:void(0)">javascript link</a>

<iframe src="https://example.com"></iframe>

Inline math must survive: $e^{i\pi} + 1 = 0$

:::warning
A callout must survive too.
:::
