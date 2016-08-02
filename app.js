'use strict'

const version = '0.5.0';

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const os = require('os');
const fileUpload = require('express-fileupload');
const imagemagick = require('imagemagick');
const shortid = require('shortid');

const defaultSettings = {
    listeningPort: 3011,
    tmpDir: os.tmpdir(),
    defaultImagePath: __dirname + '/' + 'data/default-image.jpg',
    originalsDirectory: __dirname + '/' + 'data/originals',
    basePath: '/u/',
    writeKey: '12432f23s31',
    // default 'width', but also used for the height
    defaultImageWidth: 32,
    // list of mime-types, used to override default suffix mapping
    mimeTypes: {
        'apng': 'image/png'
    },
    cache: {
        maxAgeMs: 60 * 1000
    }
};

class AquaAvatarServer {

    /**
     * Constructs the avatar server. Values in passed settings
     * will be used to override default settings. Anything not
     * specified will come fromt the default settings.
     */
    constructor(settings) {
        this.settings = defaultSettings;
        if (settings) {
            Object.assign(this.settings, settings);
        }
    }

    /**
     * Tests to see if the file exists. Synchronous operation.
     */
    fileExists(filePath) {
        try {
            return fs.statSync(filePath).isFile();
        } catch (e) {
            return false;
        }
    }

    registerHandlers(app) {

        // Returns an image for the specified avatar id, defaulting to the
        app.get(/\/(.+)/, function (req, res) {
            const avatarId = req.params[0];

            // Get the requested image size and
            let size = req.query['s'];
            if (size === undefined) {
                size = this.settings.defaultImageWidth;
            } else if (isNaN(size)) {
                size = this.settings.defaultImageWidth;
            }
            size = size + 'x' + size;

            // We default to jpg, but if the browser specifically indicates it supports
            // 'webp', then we will provide the image in that format.
            var imageType = 'jpg';
            if (req.get('accept').indexOf('image/webp') > -1) {
                imageType = 'webp';
            }

            // Allow image type override, though limited to a specific set
            // that we have tested
            if (req.query['t']) {
                if (req.query['t'] === 'jpg') {
                    imageType = 'jpg';
                } else if (req.query['t'] === 'gif') {
                    imageType = 'gif';
                } else if (req.query['t'] === 'apng') {
                    imageType = 'apng';
                }
            }

            // Provide a means to override the response mimetype. Introduced to deal
            // with the fact 'apng's were defaulting to application/octet-stream
            if (this.settings.mimeTypes && this.settings.mimeTypes[imageType]) {
                console.log('def');
                res.contentType(this.settings.mimeTypes[imageType]);
            }

            let avatarPath = this.settings.originalsDirectory + '/' + avatarId + '.dat';

            if (!this.fileExists(avatarPath)) {
                avatarPath = this.settings.defaultImagePath;
            }

            const tmpName = shortid.generate() + '.' + imageType;
            const outPath = this.settings.tmpDir + '/' + tmpName;

            console.log('outPath', outPath);
            imagemagick.convert([avatarPath, '-resize', size, outPath], function (err, stdout) {
                if (err) {
                    throw err;
                }

                // set the value for the maxAge header, default to zero if none specified
                var maxAge = 0;
                if (this.settings.cache && this.settings.cache.maxAgeMs) {
                    maxAge = this.settings.cache.maxAgeMs;
                }

                if (this.fileExists(outPath)) {
                    // send the converted file and remove it once done
                    res.sendFile(outPath, { maxAge: maxAge }, function (err) {
                        try {
                            fs.unlinkSync(outPath);
                        } catch (e) {
                            // ignore error
                        }

                    });
                } else {
                    res.status('415','unsupported media type');
                    res.write('415 - unsupported media type');
                    res.end();
                }
            }.bind(this));

        }.bind(this));

        // Uploads the image
        app.post(/\/(.+)/, function (req, res) {
            const avatarId = req.params[0];
            if (!req.files) {
                res.send('No files were uploaded.');
                return;
            }

            let avatarFile = req.files.filedata;
            console.log('files uploaded: ', req.files.filedata);
            avatarFile.mv(this.settings.originalsDirectory + '/' + avatarId + '.dat', function (err) {
                if (err) {
                    res.status(500).send(err);
                }
                else {
                    res.send('File uploaded!');
                }
            });
        }.bind(this));
     
    }

    start() {
        let app = express();

        app.use(bodyParser.urlencoded({
            extended: true
        }));

        app.use(bodyParser.json());

        app.use(fileUpload());

        app.get(/\//, function (req, res) {
            res.write('Aqua Avatar Server ' + version);
            res.end();
        });   

        var router = express.Router();

        app.use(this.settings.basePath, router);

        this.registerHandlers(router);

        app.listen(this.settings.listeningPort);
    }

}

// If we are being called directly then assume we are being
// invoked from the command line, otherwise export the class.

if (module.filename === process.mainModule.filename) {
    new AquaAvatarServer().start();
} else {
    module.exports = AquaAvatarServer;
}


