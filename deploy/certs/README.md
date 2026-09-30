# Минцифры TLS CAs

`platform-api2.max.ru` is issued by Russian Trusted Sub CA. The backend image
must trust this chain or `POST /subscriptions` (and every other Bot API call)
fails with `unable to get local issuer certificate`.

Files are the official PEM copies from Gosuslugi:

- https://gu-st.ru/content/lending/russian_trusted_root_ca_pem.crt
- https://gu-st.ru/content/lending/russian_trusted_sub_ca_pem.crt

Refresh by re-downloading those URLs into this directory, then rebuild the image.
