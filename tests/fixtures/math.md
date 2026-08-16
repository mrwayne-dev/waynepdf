# Math

## Inline

Inline: $e^{i\pi} + 1 = 0$, and mid-sentence $a^2 + b^2 = c^2$ works.

Multiple: $x = 1$, $y = 2$, $z = x + y$.

Currency non-triggers: costs $5.99, and $10, and from $20 to $30.

## Display

Double dollar:

$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

Fenced:

```math
\lim_{n \to \infty} \left(1 + \frac{1}{n}\right)^n = e
```

## Chemistry

Inline: $\ce{H2O}$ and $\ce{Fe + O2 -> Fe2O3}$.

Display:

$$
\ce{CO2 + H2O -> H2CO3}
$$

## Macros

The five bundled macros: $\RR$, $\NN$, $\ZZ$, $\QQ$, $\CC$.

## Backslash delimiters — deliberately unsupported

By design, `\(...\)` renders as literal parentheses (backslashes eaten by CommonMark escape rules): \(a^2+b^2=c^2\).

Similarly `\[...\]`: \[E = mc^2\].

Users writing math use `$` and `$$`.

## Math inside code stays literal

```js
const price = '$5';
const expr = '$a^2 + b^2$';
```

Inline code also: `$e^{i\pi}$` stays as source.

## Malformed math renders as an error, not a crash

$\frac{1}{$ has unbalanced braces.
