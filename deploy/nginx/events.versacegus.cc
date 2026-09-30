# MAX Events public HTTPS: miniapp static + reverse proxy to Nest :3100
# DNS: A events.versacegus.cc -> 2.27.41.96
# Cert: certbot --nginx -d events.versacegus.cc

server {
    listen 80;
    listen [::]:80;
    server_name events.versacegus.cc;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    root /var/www/max-events;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Max-Init-Data $http_x_max_init_data;
        proxy_read_timeout 60s;
    }

    location /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Own map basemap (DEPLOY.md «Own basemap»): one PMTiles archive read by Range requests plus the
    # font glyphs. Shared with the staging vhost and outside the static root: the miniapp rsync runs with --delete.
    location /tiles/ {
        alias /var/www/max-events-tiles/;
        types {
            application/octet-stream pmtiles;
            application/x-protobuf   pbf;
        }
        add_header Cache-Control "public, max-age=86400";
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Headers "Range";
        add_header Access-Control-Expose-Headers "Content-Length, Content-Range, Accept-Ranges";
    }
}
