Aqua Avatar Server
==================

A simple standalone, Node.js based, web server to store avatar images and serve them up at the requested scale. If a correspoding avatar is not found, then a default avatar is served up. If the browser supports webp, then the image is served up as webp, otherwise it is served up as jpg.

The image scaling capability is delegated to Imagemagick, via the imagemagick package.

The REST interface was inspired by the one used by GitHub's avatar server, mainly as a way to be easily used by the client tools already written with GitHub's avatar server in mind.

Currently there is no security around uploads, so it will either need to be implemented or the upload path protected from external requests.

Note, while it was initially desgned to be standalone, you can extend it, since the AquaAvatarServer class is exported.

Contributions and suggestions are welcome.

Current usage:

  - To read, issue a GET request to:
``` 
    http://localhost:3011/u/<userid>?s=<size>
```
  - To write, issue a POST request to 
``` 
    http://localhost:3011/u/<userid>
```

Examples
--------

  - Read, at 256px: ```http://localhost:3011/u/12345?s=256```
  - Write, with curl: ``` curl -i -F filedata=@myavatar.jpg http://localhost:3011/u/12345```

License
-------

Licensed under the GPL v3. For details please consult the LICENSE file.



