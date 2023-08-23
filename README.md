# oneSatOrdinals.js

## Overview

This library implements [1Sat Ordinals](https://docs.1satordinals.com/) and Global Order [Ordinal Lock](https://docs.1satordinals.com/ordinal-lock) Book functions such as inscribing with [Magic Attribute Protocol](https://map.sv/) (MAP) support, sending Ordinals as well as Listing, Canceling and Purchasing Inscriptions.

This code is designed to simply be included as a script tag, for Web Browser use only.

To include, simply setup script tags IN ORDER, BEFORE writing any JavaScript as per the example index.html file:

```HTML
<script src="./scripts/bsv.browser.min.js"></script>
<script src="./scripts/helpers.js"></script>
<script src="./scripts/oneSatOrdinals.js"></script>
```

This library depends on the [bsv-legacy 1.5.6 library](https://github.com/moneybutton/bsv/tree/bsv-legacy).

A helpers.js file is included with useful functions such as fetching UTXOs, broadcasting transactions, data conversion and paying for arbitrary Bitcoin transactions.

Use as you see fit, feel free to leave any feedback on the Issues tab.