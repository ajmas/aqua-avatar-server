Avatar Server
=============

A standalone nodejs based web server to store avatar images and serve them up at the requested scale. If a correspoding avatar is not found, then a default avatar is served up. If the browser supports webp, then the image is served up as webp, otherwise it is served up as jpg.

Currently there is no security around uploads, so it will either need to be implemented or the upload path protected from external requests.


Current usage:

  - To read, issue a GET request to:
``` 
    http://localhost:3011/u/<userid>?s=<size>
```
  - To write, issue a POST request to 
``` 
    http://localhost:3011/u/<userid>
```
, for example, with curl: ``` curl -i -F filedata=@myavatar.jpg http://localhost:3011/u/12345```


Credits to additional resources
-------------------------------
The provided default-image.png is taken from from https://commons.wikimedia.org/wiki/ , is authored by Elliot_Grieveson.png and licensed via Creative Commons Attribution-Share Alike 4.0 International 