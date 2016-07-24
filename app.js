'use strict'

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const fileUpload = require('express-fileupload');

const imagemagick = require('imagemagick');
const imagemagickStream = require('imagemagick-stream');

const settings = {
    listeningPort: 3011,
    defaultImagePath: __dirname + '/' + 'data/default-image.jpg',
    originalsDirectory: __dirname + '/' + 'data/originals',
    basePath: '/u/',
    writeKey: '12432f23s31'
};



function fileExists(filePath) {
    try {
        return fs.statSync(filePath).isFile();
    } catch (e) {
        console.log(e);
        return false;
    }
}

// TODO see: http://blog.ragingflame.co.za/2015/2/6/resizing-images-in-nodejs-applications

function registerHandlers(app) {
    // Scales and returns the images
    app.get(/\/(.+)/, function (req, res) {
        const avatarId = req.params[0];

        let size = req.query['s'];
        if (size === undefined) {
            size = 32;
        } else if (isNaN(size)) {
            size = 32;
        }
        size = size + 'x' + size;

        var imageType = 'jpg';
        if (req.get('accept').indexOf('image/webp') > -1) {
           console.log('accepts webp');
           imageType = 'webp';
        }

        if (req.query['t'] && req.query['t'] === 'jpg') {
            imageType = 'jpg';
        }


        let avatarPath = settings.originalsDirectory + '/' + avatarId + '.jpg';

        if (!fileExists(avatarPath)) {
            avatarPath = settings.defaultImagePath;
        }

        let outPath = __dirname + '/' + 'out.' + imageType;
        imagemagick.convert([avatarPath, '-resize', size, outPath],
        function(err, stdout){
          if (err) {throw err;}
          console.log('stdout:', stdout);
          res.sendFile(outPath);
          // TODO erase temporary file
        });
    });

    // Uploads the image
    app.post(/\/(.+)/, function (req, res) {
        const avatarId = req.params[0];
        if (!req.files) {
            res.send('No files were uploaded.');
            return;
        }

        let avatarFile = req.files.filedata;
        console.log('files uploaded: ', req.files.filedata);
        avatarFile.mv(settings.originalsDirectory + '/' + avatarId + '.jpg', function(err) {
        if (err) {
            res.status(500).send(err);
        }
        else {
            res.send('File uploaded!');
        }
    });
    });
}

let app = express();

app.use(bodyParser());
app.use(fileUpload());

var router = express.Router();

app.use(settings.basePath, router);

registerHandlers(router);

app.listen(settings.listeningPort);
