# YFM sample

This file exercises the YFM features the editor must support. 123

## Note

{% note info "Heads up" %}

This is an informational note. It should render as a styled callout.

{% endnote %}

## Cut (кат)

{% cut "Show details" %}

Hidden content lives inside the cut and is revealed on click.

- It can contain lists
- ...and other markup

{% endcut %}

## Multiline table

#|
||

**Feature**

|

**Notes**

||
||

Multiline cells

|

A cell can span
multiple lines and contain a list:

- one
- two
- три

||
||

Inline code

|

`like this`

||
|#

## LaTeX / KaTeX

Inline math like $c = \pm\sqrt{a^2 + b^2}$ should render within the text.

A display formula on its own lines:

$$
\int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}
$$

## Mermaid

```mermaid
flowchart LR
    Edit[Edit Markdown] --> Preview[Preview YFM]
    Preview --> Render[Render Mermaid]
```

## Regular content

Plain **bold**, _italic_, and a [link](https://diplodoc.com).
