# Tesseract browser assets

These files are served locally so browser OCR does not depend on jsDelivr at runtime.

- `worker.min.js`: `tesseract.js` 7.0.0
- `tesseract-core-lstm.*`: `tesseract.js-core` 7.0.0
- `lang/*.traineddata.gz`: `@tesseract.js-data/{spa,eng}` 4.0.0 `best_int`

The worker and core are distributed under Apache-2.0. The language data uses the
license provided by the corresponding `@tesseract.js-data` package.
