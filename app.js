'use strict'

let version = 'unknown';

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const os = require('os');
const fileUpload = require('express-fileupload');
const imagemagick = require('imagemagick');
const shortid = require('shortid');
const NodeCache = require( 'node-cache' );
const imageCache = new NodeCache();

const defaultSettings = {
    listeningPort: 3011,
    tmpDir: os.tmpdir(),
    defaultImagePath: __dirname + '/' + 'data/default-image.jpg',
    originalsDirectory: __dirname + '/' + 'data/originals',
    basePath: '/u/',
    writeKey: '12432f23s31',
    // default 'width', but also used for the height
    defaultImageWidth: 32,
    maxSize: 512,
    // list of mime-types, used to override default suffix mapping
    mimeTypes: {
        'apng': 'image/png'
    },
    cache: {
        maxAgeMs: '10m'
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
        this.webpAvailable = true;

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


    /**
     * Returns a promise. On success the value is the path
     * of the created image.
     */
    convert(inpath, outPath, size, extraParams) {
        var scope = this;

        return new Promise(function(resolve,reject) {
            //var outPath = '/tmp/aqua.jpg';

            if (inpath) {
                inpath = scope.settings.defaultImagePath;
            }

            if (!size) {
                size = scope.settings.defaultImageWidth;;
                size = size + 'x' + size;
            }

            let imagemagickParams = [inpath, '-resize', size];
            if (extraParams) {
                imagemagickParams.push(...extraParams);
            }
            imagemagickParams.push(outPath);

            imagemagick.convert(imagemagickParams, function (err, stdout) {
                if (err) {
                    console.log('fatal', err);
                    reject(err);
                    return
                }
                resolve(outPath);
            });
        });
    }

    /**
     * Do preflight tests to ensure everything is working
     */
    preflight() {
        var scope = this;

        var sequence = Promise.resolve();

        return sequence.then(function () {
            // Ensure we are able to generate a jpg from the default image
            // This is fatal if we are unable to. We need imagemagick for this

            var outPath = '/tmp/aqua.jpg';
            var defaultImage = scope.settings.defaultImagePath;

            var size = scope.settings.defaultImageWidth;;
            size = size + 'x' + size;

            return scope.convert(defaultImage, outPath, size);
        }).then(function () {
            // Ensure we are able to generate a webp from the default image
            // This is non fatal if we are unable to. Given that cwebp is not
            // available via apt-get, we can't make this a 'must have' for now.

            var outPath = '/tmp/aqua.webp';
            var defaultImage = scope.settings.defaultImagePath;

            var size = scope.settings.defaultImageWidth;;
            size = size + 'x' + size;

            return scope.convert(defaultImage, outPath, size).catch(function (error) {
                console.log('warn', 'no webp capability detected, disabling');
                scope.webpAvailable = false;
            });
        });

    }

    isWritePermitted(req) {
        const remoteAddr = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        return (['::1','127.0.0.1', 'localhost','::ffff:127.0.0.1'].indexOf(remoteAddr) > -1);
    }

    registerHandlers(app) {

        // Returns an image for the specified avatar id, defaulting to the
        app.get(/\/(.+)/, function (req, res) {
            const avatarId = req.params[0];

            // set the value for the maxAge header, default to zero if none specified
            var maxAge = 0;
            if (this.settings.cache && this.settings.cache.maxAgeMs) {
                maxAge = this.settings.cache.maxAgeMs;
            }

            try {
                var imagePath = imageCache.get(req.url);
                if (this.fileExists(imagePath)) {
                    res.sendFile(imagePath, { maxAge: maxAge }, function (err) {
                        // do nothing
                    });
                    return;
                } else {
                    imageCache.del(req.url);
                }
            } catch (err) {
                // do nothing
            }

            let singleFrameType = true;

            // Get the requested image size and deal with invalid or absent values

            let size = req.query['s'];
            if (size === undefined) {
                size = this.settings.defaultImageWidth;
            } else if (isNaN(size)) {
                size = this.settings.defaultImageWidth;
            } else if (size > this.settings.maxSize) {
                size = this.settings.maxSize;
            }
            size = size + 'x' + size;

            // We default to jpg, but if the browser specifically indicates it supports
            // 'webp', then we will provide the image in that format.

            var imageType = 'jpg';
            if (this.webpAvailable && req.get('accept').indexOf('image/webp') > -1) {
                imageType = 'webp';
            }

            // Allow image type override, though limited to a specific set
            // that we have tested

            if (req.query['t']) {
                var supported = true;
                var type = req.query['t'];
                if (type === 'jpg') {
                    imageType = 'jpg';
                } else if (type === 'gif') {
                    imageType = 'gif';
                } else if (type === 'png') {
                    imageType = 'png';
                } else if (type === 'apng') {
                    imageType = 'apng';
                } else if (type === 'webp') {
                    if (this.webpAvailable) {
                        imageType = 'webp';
                    } else {
                        supported = false;
                    }
                } else {
                    supported = false;
                }

                if (!supported) {
                    res.status(402).send('402 - Unsupported requested format ' + type);
                    return;
                }
            }

            // Provide a means to override the response mimetype. Introduced to deal
            // with the fact 'apng's were defaulting to application/octet-stream

            if (this.settings.mimeTypes && this.settings.mimeTypes[imageType]) {
                res.contentType(this.settings.mimeTypes[imageType]);
            }


            //

            let avatarPath = this.settings.originalsDirectory + '/' + avatarId + '.dat';

            if (!this.fileExists(avatarPath)) {
                avatarPath = this.settings.defaultImagePath;
            }

            const tmpName = 'aqua-' + avatarId + '-' + shortid.generate() + '.' + imageType;
            const outPath = this.settings.tmpDir + '/' + tmpName;

            // deal with issue of multi-frame files resulting in multiple
            // files, when converted to formats that only support one frame.

            if (imageType === 'gif' || imageType === 'apng') {
                singleFrameType = false;
            }

            let imagemagickParams = [];
            if (singleFrameType) {
                imagemagickParams.push('-delete');
                imagemagickParams.push('1--1');
            }

            //

            this.convert(avatarPath, outPath, size, imagemagickParams).then(function(outPath) {
                if (this.fileExists(outPath)) {
                    imageCache.set(req.url, outPath);
                    // send the converted file and remove it once done
                    res.sendFile(outPath, { maxAge: maxAge }, function (err) {
                        // do nothing
                    });
                } else {
                    res.status('415').send('415 - unsupported media type');
                }
            }.bind(this)).catch(function(err) {
                console.log('error',err);
                res.status(500).end();
            });

        }.bind(this));

        // Uploads the image
        app.post(/\/(.+)/, function (req, res) {
            if (!this.isWritePermitted(req)) {
                res.status(401).end();
                return;
            }

            const avatarId = req.params[0];

            if (!req.files) {
                res.send('No files were uploaded.');
                return;
            }

            let avatarFile = req.files.filedata;
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

    /**
     * starts the server, first performing a preflight test
     */
    start() {
        var scope = this;
        this.preflight().then(function(path) {
            console.log('debug','preflight passed');
        }).then(function() {
            let app = express();

            app.use(bodyParser.urlencoded({
                extended: true
            }));

            app.use(bodyParser.json());

            app.use(fileUpload());

            app.get(/^\/$/, function (req, res) {
                res.write('Aqua Avatar Server ' + version);
                res.end();
            });

            var router = express.Router();

            app.use(scope.settings.basePath, router);

            scope.registerHandlers(router);

            app.listen(scope.settings.listeningPort);
            console.log('debug','listening on port', scope.settings.listeningPort);
        }).catch(function (error) {
            console.log('fatal','preflight failed', error);
            process.exit();
        });
    }

}

// If we are being called directly then assume we are being
// invoked from the command line, otherwise export the class.

if (module.filename === process.mainModule.filename) {
    // get the version, but only if we are launched directly
    version = process.env.npm_package_version;
    new AquaAvatarServer().start();
} else {
    module.exports = AquaAvatarServer;
}


