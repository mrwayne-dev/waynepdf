# Math Baseline Fixture

Every construct below currently FAILS to render as math. This fixture and its
snapshot document that failure. Phase 4 introduces real math rendering and will
update the snapshot.

## Inline, dollar delimiters

Euler's identity: $e^{i\pi} + 1 = 0$ appears inline.

## Block, double dollar

$$\int_{0}^{1} x^2\,dx = \frac{1}{3}$$

## Paren delimiters

Pythagoras: \(a^2 + b^2 = c^2\) — note markdown-it consumes the backslashes.

## Bracket delimiters

\[E = mc^2\]

## Fenced math block

```math
\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}
```

## Literal Unicode math symbols (these DO render)

∑ ∏ ∫ √ ≠ ≤ ≥ ∞ α β γ δ θ λ π σ ℵ ∂ ∇ ⊗
