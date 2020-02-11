const User = require('./models/user');
const Entry = require('./models/entry');
const Set = require('./models/set');
const Moc = require('./models/moc');
const Part = require('./models/part');
const bodyParser = require('body-parser');
const request = require("request");
const config = require('./config');
const mongoose = require('mongoose');
const moment = require('moment');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const BasicStrategy = require('passport-http').BasicStrategy;
const express = require('express');
const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(express.static('public'));

mongoose.Promise = global.Promise;


// ---------------- RUN/CLOSE SERVER -----------------------------------------------------
let server = undefined;

function runServer(urlToUse) {
    return new Promise((resolve, reject) => {
        mongoose.connect(urlToUse, err => {
            if (err) {
                return reject(err);
            }
            server = app.listen(config.PORT, () => {
                console.log(`Listening on localhost:${config.PORT}`);
                resolve();
            }).on('error', err => {
                mongoose.disconnect();
                reject(err);
            });
        });
    });
}

if (require.main === module) {
    runServer(config.DATABASE_URL).catch(err => console.error(err));
}

function closeServer() {
    return mongoose.disconnect().then(() => new Promise((resolve, reject) => {
        console.log('Closing server');
        server.close(err => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    }));
}

function deleteALLPartsCorrespondingWithDeletedSetsOrMocs(set_num, loggedInUserName) {
    //console.log("inside the function", set_num, loggedInUserName);
    Part.deleteMany({
        set_num,
        loggedInUserName
    }).exec().then(function (entry) {
        console.log("done", entry.deletedCount);
        return {
            set_num,
            loggedInUserName
        };
    }).catch(function (err) {
        console.log("fail");
        return {
            message: err
        };
    });
}

function deleteSOMEPartsCorrespondingWithDeletedSetsOrMocs(deleteWhat, deleteSetIDValue, loggedInUserName) {
    //console.log("inside the deleteSOMEPartsCorrespondingWithDeletedSetsOrMocs function");
    //console.log(deleteSetIDValue, "<== req.body.deleteSetIDValue");
    if (deleteWhat == "set") {
        Part.deleteMany({
            from_set_id: deleteSetIDValue,
            loggedInUserName
        }).exec().then(function (entry) {
            console.log("updated part results is ===> ", entry.message);
            return entry.message;
        }).catch(function (err) {
            console.log("fail updated part results is ===>", err);
            return err;
        });
    } else {
        Part.deleteMany({
            from_moc_id: deleteSetIDValue,
            loggedInUserName
        }).exec().then(function (entry) {
            console.log("updated part results is ===> ", entry.message);
            return entry.message;
        }).catch(function (err) {
            console.log("fail updated part results is ===>", err);
            return err;
        });
    }


}

app.post('/item/create', function (req, res) {
    let itemNum = req.body.itemNum;
    let itemType = req.body.itemType;
    let loggedInUserName = req.body.loggedInUserName;


    if (itemType == 'set') {
        // make request for set details
        request({
            method: 'GET',
            uri: 'https://rebrickable.com/api/v3/lego/sets/' + itemNum + '?key=4f8845c5d9212c179c08fe6f0e0d2d0c',
            gzip: true,
            data: {
                key: '4f8845c5d9212c179c08fe6f0e0d2d0c'
            },
            dataType: 'json',
        }, function (error, response, body) {
            // if the search for set details returns results
            if (Object.keys(JSON.parse(body)).length > 1) {
                // add set to the database
                Set.create({
                    set_num: JSON.parse(body).set_num,
                    set_name: JSON.parse(body).name,
                    year: JSON.parse(body).year,
                    theme_id: JSON.parse(body).theme_id,
                    num_parts: JSON.parse(body).num_parts,
                    set_img_url: JSON.parse(body).set_img_url,
                    set_url: JSON.parse(body).set_url,
                    permanent_build: 0,
                    in_wishlist: 0,
                    storage_location: '',
                    loggedInUserName: loggedInUserName
                }, (err, newSet) => {
                    //if creating a new set details in the DB returns an error..
                    if (err) {
                        //display it
                        return res.status(500).json({
                            message: 'Internal Server Error'
                        });
                    }
                    //if creating a new set in the DB is successfull
                    if (newSet) {
                        console.log("newSet ==>", newSet);
                        //                        console.log(JSON.parse(body));
                        // ---------------------------------------------------------------------------------------------------------------------------
                        // make request for parts related to a set
                        request({
                            method: 'GET',
                            uri: 'https://rebrickable.com/api/v3/lego/sets/' + itemNum + '/parts?key=4f8845c5d9212c179c08fe6f0e0d2d0c&page_size=1000&inc_part_details=1',
                            gzip: true,
                            data: {
                                key: '4f8845c5d9212c179c08fe6f0e0d2d0c'
                            },
                            dataType: 'json',
                        }, function (error, response, body) {
                            // add set to the database
                            // if the search for set returns results
                            if (JSON.parse(body).results.length > 1) {
                                for (setCounter = 0; setCounter < JSON.parse(body).results.length; setCounter++) {
                                    Part.create({
                                        element_id: JSON.parse(body).results[setCounter].element_id,
                                        inv_part_id: JSON.parse(body).results[setCounter].inv_part_id,
                                        is_spare: JSON.parse(body).results[setCounter].is_spare,
                                        num_sets: JSON.parse(body).results[setCounter].num_sets,
                                        part_name: JSON.parse(body).results[setCounter].part.name,
                                        part_cat_id: JSON.parse(body).results[setCounter].part.part_cat_id,
                                        part_img_url: JSON.parse(body).results[setCounter].part.part_img_url,
                                        part_num: JSON.parse(body).results[setCounter].part.part_num,
                                        part_url: JSON.parse(body).results[setCounter].part.part_url,
                                        part_year_from: JSON.parse(body).results[setCounter].part.year_from,
                                        part_year_to: JSON.parse(body).results[setCounter].part.year_to,
                                        quantity: JSON.parse(body).results[setCounter].quantity,
                                        set_num: JSON.parse(body).results[setCounter].set_num,
                                        from_set_id: newSet._id,
                                        from_moc_id: 0,
                                        permanent_build: 0,
                                        in_wishlist: 0,
                                        storage_location: '',
                                        loggedInUserName: loggedInUserName
                                    }, (err, item) => {
                                        //if creating a new part in the DB returns an error..
                                        if (err) {
                                            //display it
                                            return res.status(500).json({
                                                message: 'Internal Server Error'
                                            });
                                        }
                                        //if creating a new part in the DB is succefull
                                        if (item) {
                                            //                        return res.json(JSON.parse(body));
                                        }
                                    });
                                }
                                return res.json({
                                    'message': 'success'
                                })
                            }
                            // if there are no results...
                            else {
                                return res.status(444).json({
                                    message: 'Invalid part number'
                                });
                            }
                        });
                    }
                });
            }
            // if there are no results...
            else {
                return res.status(444).json({
                    message: 'Invalid set number'
                });
            }
        });

    } else if (itemType == 'moc') {
        // add MOC to the database
        //         make request for moc details
        request({
            method: 'GET',
            uri: 'https://rebrickable.com/api/v3/lego/mocs/' + itemNum + '?key=4f8845c5d9212c179c08fe6f0e0d2d0c',
            gzip: true,
            data: {
                key: '4f8845c5d9212c179c08fe6f0e0d2d0c'
            },
            dataType: 'json',
        }, function (error, response, body) {
            //console.log(JSON.parse(body));
            // if the search for moc details returns results
            if (Object.keys(JSON.parse(body)).length > 1) {
                // add moc to the database
                Moc.create({
                    moc_num: JSON.parse(body).set_num,
                    moc_name: JSON.parse(body).name,
                    year: JSON.parse(body).year,
                    theme_id: JSON.parse(body).theme_id,
                    num_parts: JSON.parse(body).num_parts,
                    moc_img_url: JSON.parse(body).moc_img_url,
                    moc_url: JSON.parse(body).moc_url,
                    designer_name: JSON.parse(body).designer_name,
                    designer_url: JSON.parse(body).designer_url,
                    permanent_build: 0,
                    in_wishlist: 0,
                    storage_location: '',
                    loggedInUserName: loggedInUserName
                }, (err, newMoc) => {
                    //if creating a new moc details in the DB returns an error..
                    if (err) {
                        //display it
                        return res.status(500).json({
                            message: 'Internal Server Error'
                        });
                    }
                    //if creating a new moc in the DB is successfull
                    if (newMoc) {

                        console.log("newMoc ==> ", newMoc);
                        //                        console.log(JSON.parse(body));
                        // ---------------------------------------------------------------------------------------------------------------------------
                        // make request for parts related to a moc
                        request({
                            method: 'GET',
                            uri: 'https://rebrickable.com/api/v3/lego/mocs/' + itemNum + '/parts?key=4f8845c5d9212c179c08fe6f0e0d2d0c&page_size=1000&inc_part_details=1',
                            gzip: true,
                            data: {
                                key: '4f8845c5d9212c179c08fe6f0e0d2d0c'
                            },
                            dataType: 'json',
                        }, function (error, response, body) {
                            // add moc to the database
                            // if the search for moc returns results
                            if (JSON.parse(body).results.length > 1) {
                                for (setCounter = 0; setCounter < JSON.parse(body).results.length; setCounter++) {
                                    Part.create({
                                        element_id: JSON.parse(body).results[setCounter].element_id,
                                        inv_part_id: JSON.parse(body).results[setCounter].inv_part_id,
                                        is_spare: JSON.parse(body).results[setCounter].is_spare,
                                        num_sets: JSON.parse(body).results[setCounter].num_sets,
                                        part_name: JSON.parse(body).results[setCounter].part.name,
                                        part_cat_id: JSON.parse(body).results[setCounter].part.part_cat_id,
                                        part_img_url: JSON.parse(body).results[setCounter].part.part_img_url,
                                        part_num: JSON.parse(body).results[setCounter].part.part_num,
                                        part_url: JSON.parse(body).results[setCounter].part.part_url,
                                        part_year_from: JSON.parse(body).results[setCounter].part.year_from,
                                        part_year_to: JSON.parse(body).results[setCounter].part.year_to,
                                        quantity: JSON.parse(body).results[setCounter].quantity,
                                        set_num: JSON.parse(body).results[setCounter].set_num,
                                        from_set_id: 0,
                                        from_moc_id: newMoc._id,
                                        permanent_build: 0,
                                        in_wishlist: 0,
                                        storage_location: '',
                                        loggedInUserName: loggedInUserName
                                    }, (err, item) => {
                                        //if creating a new part in the DB returns an error..
                                        if (err) {
                                            //display it
                                            return res.status(500).json({
                                                message: 'Internal Server Error'
                                            });
                                        }
                                        //if creating a new part in the DB is succefull
                                        if (item) {
                                            //                        return res.json(JSON.parse(body));
                                        }
                                    });
                                }
                                return res.json({
                                    'message': 'success'
                                })
                            }
                            // if there are no results...
                            else {
                                return res.status(444).json({
                                    message: 'Invalid part number'
                                });
                            }
                        });
                    }
                });
            }
            // if there are no results...
            else {
                return res.status(444).json({
                    message: 'Invalid MOC number'
                });
            }
        });

    } else if (itemType == 'part') {
        request({
            method: 'GET',
            uri: 'https://rebrickable.com/api/v3/lego/parts/' + itemNum + '?key=4f8845c5d9212c179c08fe6f0e0d2d0c',
            gzip: true,
            data: {
                key: '4f8845c5d9212c179c08fe6f0e0d2d0c'
            },
            dataType: 'json',
        }, function (error, response, body) {
            // if the search for part returns results
            if (Object.keys(JSON.parse(body)).length > 1) {
                // add part to the database
                Part.create({
                    element_id: 0,
                    inv_part_id: 0,
                    is_spare: 0,
                    num_sets: 0,
                    part_name: JSON.parse(body).name,
                    part_cat_id: JSON.parse(body).part_cat_id,
                    part_img_url: JSON.parse(body).part_img_url,
                    part_num: JSON.parse(body).part_num,
                    part_url: JSON.parse(body).part_url,
                    part_year_from: JSON.parse(body).year_from,
                    part_year_to: JSON.parse(body).year_to,
                    quantity: 1,
                    set_num: 0,
                    from_set_id: 0,
                    from_moc_id: 0,
                    permanent_build: 0,
                    in_wishlist: 0,
                    storage_location: '',
                    loggedInUserName: loggedInUserName
                }, (err, item) => {
                    //if creating a new part in the DB returns an error..
                    if (err) {
                        //display it
                        return res.status(500).json({
                            message: 'Internal Server Error'
                        });
                    }
                    //if creating a new part in the DB is succefull
                    if (item) {
                        return res.json(JSON.parse(body));
                        //                        return res.json({
                        //                            'message': 'success'
                        //                        })
                    }
                });
            }
            // if there are no results...
            else {
                return res.status(444).json({
                    message: 'Invalid part number'
                });
            }
        });
    }
});



// ---------------USER ENDPOINTS-------------------------------------
// POST -----------------------------------
// creating a new user
app.post('/users/create', (req, res) => {

    //take the name, username and the password from the ajax api call
    let username = req.body.username;
    let password = req.body.password;

    //exclude extra spaces from the username and password
    username = username.trim();
    password = password.trim();

    //create an encryption key
    bcrypt.genSalt(10, (err, salt) => {

        //if creating the key returns an error...
        if (err) {

            //display it
            return res.status(500).json({
                message: 'Internal server error'
            });
        }

        //using the encryption key above generate an encrypted pasword
        bcrypt.hash(password, salt, (err, hash) => {

            //if creating the ncrypted pasword returns an error..
            if (err) {

                //display it
                return res.status(500).json({
                    message: 'Internal server error'
                });
            }

            //using the mongoose DB schema, connect to the database and create the new user
            User.create({
                username,
                password: hash,
            }, (err, item) => {

                //if creating a new user in the DB returns an error..
                if (err) {
                    //display it
                    return res.status(500).json({
                        message: 'Internal Server Error'
                    });
                }
                //if creating a new user in the DB is successfull
                if (item) {

                    //display the new user
                    return res.json(item);
                }
            });
        });
    });
});

// log in a user
app.post('/users/login', function (req, res) {

    //take the username and the password from the ajax api call
    const username = req.body.username;
    const password = req.body.password;

    //using the mongoose DB schema, connect to the database and the user with the same username as above
    User.findOne({
        username: username
    }, function (err, items) {

        //if the there is an error connecting to the DB
        if (err) {

            //display it
            return res.status(500).json({
                message: "Internal server error"
            });
        }
        // if there are no users with that username
        if (!items) {
            //display it
            return res.status(401).json({
                message: "Not found!"
            });
        }
        //if the username is found
        else {

            //try to validate the password
            items.validatePassword(password, function (err, isValid) {

                //if the connection to the DB to validate the password is not working
                if (err) {

                    //display error
                    console.log('Could not connect to the DB to validate the password.');
                }

                //if the password is not valid
                if (!isValid) {

                    //display error
                    return res.status(401).json({
                        message: "Password Invalid"
                    });
                }
                //if the password is valid
                else {
                    //return the logged in user
                    console.log(`User \`${username}\` logged in.`);
                    return res.json(items);
                }
            });
        };
    });
});






//=============== SETS api endpoints=======================================================


// PUT --------------------------------------
app.put('/inventory-set/update-permanent-build', function (req, res) {
    let toUpdate = {};

    let updateableFields = ['set_name', 'permanent_build'];
    updateableFields.forEach(function (field) {
        if (field in req.body) {
            toUpdate[field] = req.body[field];
        }
    });
    //console.log(toUpdate);
    //permanent_build
    Set
        .updateMany({
            set_name: req.body.set_name
        }, {
            $set: {
                permanent_build: req.body.permanent_build
            }
        }).exec().then(function (updated_set) {
            return res.status(204).json({
                updated_set: updated_set
            });
        }).catch(function (err) {
            return res.status(500).json({
                message: 'Updating the permanent build failed'
            });
        });
});

app.put('/inventory-set/add-storage-bin', function (req, res) {
    let toUpdate = {};
    let updateableFields = ['set_num', 'storage_location'];
    updateableFields.forEach(function (field) {
        if (field in req.body) {
            toUpdate[field] = req.body[field];
        }
    });
    //console.log(toUpdate);
    //permanent_build
    Set
        .updateMany({
            set_num: req.body.set_num
        }, {
            $set: {
                storage_location: req.body.storage_location
            }
        }).exec().then(function (updated_set) {
            return res.status(204).json({
                updated_set: updated_set
            });
        }).catch(function (err) {
            return res.status(500).json({
                message: 'Updating the storage location failed'
            });
        });
});

// GET ------------------------------------
// accessing all of a user's items
app.get('/inventory-set/show-aggregate/:username', function (req, res) {
    // retrieve distinct sets
    Set
        .aggregate(
        [
                {
                    $match: {
                        loggedInUserName: req.params.username,
                    }
            },

                {
                    $group: {
                        _id: {
                            set_num: "$set_num",
                            set_name: "$set_name"
                        },
                        count: {
                            $sum: 1
                        }
                    }
            },

                {
                    $sort: {
                        "_id.set_name": 1
                    }
            }
        ]
        )
        .sort('set_name')
        .then(function (sets) {
            res.json({
                sets
            });
        })
        .catch(function (err) {
            console.error(err);
            res.status(500).json({
                message: 'Inventory set not found'
            });
        });
});

app.get('/inventory-set/show-details/:username/:setNumber', function (req, res) {
    // retrieve all sets
    Set
        .find({
            loggedInUserName: req.params.username,
            set_num: req.params.setNumber
        })
        .sort('-addedToDB')
        .then(function (sets) {
            res.json({
                sets
            });
        })
        .catch(function (err) {
            console.error(err);
            res.status(500).json({
                message: 'Inventory set not found'
            });
        });
});
app.get('/inventory-set/count/:username/:itemNumber', function (req, res) {

    Set
        .find({
            loggedInUserName: req.params.username,
            set_num: req.params.itemNumber
        })
        .sort('-addedToDB')
        .then(function (results) {
            //create a totalQuantity variable
            let totalQuantity = 0;
            let totalAvailable = 0;
            let totalInWishList = 0;
            //loop through the entire array of sets ...
            for (let i = 0; i < results.length; i++) {
                //... and sum up the quantities for them
                totalQuantity = totalQuantity + 1;

                //if the set is not permanent build ...
                if (parseInt(results[i].permanent_build) == 0) {
                    //... count it as available
                    totalAvailable = totalAvailable + 1;
                }

                //if the set is in the wishlist ...
                if (parseInt(results[i].in_wishlist) == 1) {
                    //... count it
                    totalInWishList = totalInWishList + 1;
                }
            }

            console.log("sets --> ", req.params.itemNumber, totalQuantity, totalAvailable, totalInWishList);
            //return the sum of all quantities for a specific set
            res.json({
                totalQuantity,
                totalAvailable,
                totalInWishList
            });
        })
        .catch(function (err) {
            console.error(err);
            res.status(500).json({
                message: 'Inventory set not found'
            });
        });
});

app.get('/inventory-set/get-in-your-sets/:username/:itemNumber', function (req, res) {

    Set
        .find({
            loggedInUserName: req.params.username,
            set_num: req.params.itemNumber
        })
        .sort('-addedToDB')
        .then(function (results) {
            //create a totalInYourSetsArray array
            let totalInYourSetsArray = [];
            //count the number of unique items added to the array
            let arrayCounter = 0;
            //loop through the entire array of sets ...
            for (let i = 0; i < results.length; i++) {
                //if the set_numb is not set of initial array ...
                if (totalInYourSetsArray.indexOf(results[i].set_num) == -1) {
                    //... add it
                    totalInYourSetsArray[arrayCounter] = results[i].set_num;
                    // ... and increment the number of unique items added to the array
                    arrayCounter++;
                }
            }
            //convert the array to string
            let totalInYourSetsString = totalInYourSetsArray.toString();

            //return all the set numbers for a specific set
            res.json({
                totalInYourSetsString
            });
        })
        .catch(function (err) {
            console.error(err);
            res.status(500).json({
                message: 'Inventory set not found'
            });
        });
});

// DELETE ----------------------------------------
// deleting a set by name

app.delete('/inventory-set/delete-set-by-number', function (req, res) {
    console.log(req.body.set_num, req.body.loggedInUserName);
    //if the number of sets to delete is the same with maxim number of sets in the inventory, delete the entire set
    if (req.body.deleteSetMaxQuantityValue == req.body.deleteFromInventoryValue) {

        Set.deleteMany({
            set_num: req.body.set_num,
            loggedInUserName: req.body.loggedInUserName
        }).exec().then(function (entry) {
            deleteALLPartsCorrespondingWithDeletedSetsOrMocs(req.body.set_num, req.body.loggedInUserName);
            console.log("done", entry.deletedCount);
            res.status(200).json(entry.deletedCount);

        }).catch(function (err) {
            console.log("delete all sets fail");
            return {
                message: err
            };
        });

    }
    // otherwise update only the quantity (https://stackoverflow.com/questions/19065615/how-to-delete-n-numbers-of-documents-in-mongodb)
    else {
        //        console.log("setId to delete ==> ", req.body.deleteSetIDValue);
        Set.deleteMany({
            _id: req.body.deleteSetIDValue
        }).exec().then(function (items) {
            deleteSOMEPartsCorrespondingWithDeletedSetsOrMocs("set", req.body.deleteSetIDValue, req.body.loggedInUserName);
            res.status(200).json(items);
        }).catch(function (err) {
            console.log("delete only some sets fail");
            return {
                message: err
            };
        });

    }
});


//=============== MOC api endpoints=======================================================

// PUT --------------------------------------
app.put('/inventory-moc/update-permanent-build', function (req, res) {
    let toUpdate = {};

    let updateableFields = ['moc_name', 'permanent_build'];
    updateableFields.forEach(function (field) {
        if (field in req.body) {
            toUpdate[field] = req.body[field];
        }
    });
    //console.log(toUpdate);
    //permanent_build
    Moc
        .updateMany({
            moc_name: req.body.moc_name
        }, {
            $set: {
                permanent_build: req.body.permanent_build
            }
        }).exec().then(function (updated_moc) {
            return res.status(204).json({
                updated_moc: updated_moc
            });
        }).catch(function (err) {
            return res.status(500).json({
                message: 'Updating the permanent build failed'
            });
        });
});

app.put('/inventory-moc/add-storage-bin', function (req, res) {
    let toUpdate = {};
    let updateableFields = ['moc_num', 'storage_location'];
    updateableFields.forEach(function (field) {
        if (field in req.body) {
            toUpdate[field] = req.body[field];
        }
    });
    //console.log(toUpdate);
    //permanent_build
    Moc
        .updateMany({
            moc_num: req.body.moc_num
        }, {
            $set: {
                storage_location: req.body.storage_location
            }
        }).exec().then(function (updated_moc) {
            return res.status(204).json({
                updated_moc: updated_moc
            });
        }).catch(function (err) {
            return res.status(500).json({
                message: 'Updating the storage location failed'
            });
        });
});

// GET ------------------------------------
// accessing all of a user's items
app.get('/inventory-moc/show-aggregate/:username', function (req, res) {
    // retrieve distinct mocs
    Moc
        .aggregate(
        [
                {
                    $match: {
                        loggedInUserName: req.params.username,
                    }
            },

                {
                    $group: {
                        _id: {
                            moc_num: "$moc_num",
                            moc_name: "$moc_name"
                        },
                        count: {
                            $sum: 1
                        }
                    }
            },

                {
                    $sort: {
                        "_id.moc_name": 1
                    }
            }
        ]
        )
        .sort('moc_name')
        .then(function (mocs) {
            res.json({
                mocs
            });
        })
        .catch(function (err) {
            console.error(err);
            res.status(500).json({
                message: 'Inventory moc not found'
            });
        });
});

app.get('/inventory-moc/show-details/:username/:mocNumber', function (req, res) {
    // retrieve all mocs
    Moc
        .find({
            loggedInUserName: req.params.username,
            moc_num: req.params.mocNumber
        })
        .sort('-addedToDB')
        .then(function (mocs) {
            res.json({
                mocs
            });
        })
        .catch(function (err) {
            console.error(err);
            res.status(500).json({
                message: 'Inventory moc not found'
            });
        });
});
app.get('/inventory-moc/count/:username/:itemNumber', function (req, res) {

    Moc
        .find({
            loggedInUserName: req.params.username,
            moc_num: req.params.itemNumber
        })
        .sort('-addedToDB')
        .then(function (results) {
            //create a totalQuantity variable
            let totalQuantity = 0;
            let totalAvailable = 0;
            let totalInWishList = 0;
            //loop through the entire array of mocs ...
            for (let i = 0; i < results.length; i++) {
                //... and sum up the quantities for them
                totalQuantity = totalQuantity + 1;

                //if the moc is not permanent build ...
                if (parseInt(results[i].permanent_build) == 0) {
                    //... count it as available
                    totalAvailable = totalAvailable + 1;
                }

                //if the moc is in the wishlist ...
                if (parseInt(results[i].in_wishlist) == 1) {
                    //... count it
                    totalInWishList = totalInWishList + 1;
                }
            }

            console.log("mocs --> ", req.params.itemNumber, totalQuantity, totalAvailable, totalInWishList);
            //return the sum of all quantities for a specific moc
            res.json({
                totalQuantity,
                totalAvailable,
                totalInWishList
            });
        })
        .catch(function (err) {
            console.error(err);
            res.status(500).json({
                message: 'Inventory moc not found'
            });
        });
});

app.get('/inventory-moc/get-in-your-sets/:username/:itemNumber', function (req, res) {

    Moc
        .find({
            loggedInUserName: req.params.username,
            moc_num: req.params.itemNumber
        })
        .sort('-addedToDB')
        .then(function (results) {
            //create a totalInYourSetsArray array
            let totalInYourSetsArray = [];
            //count the number of unique items added to the array
            let arrayCounter = 0;
            //loop through the entire array of mocs ...
            for (let i = 0; i < results.length; i++) {
                //if the set_numb is not moc of initial array ...
                if (totalInYourSetsArray.indexOf(results[i].set_num) == -1) {
                    //... add it
                    totalInYourSetsArray[arrayCounter] = results[i].set_num;
                    // ... and increment the number of unique items added to the array
                    arrayCounter++;
                }
            }
            //convert the array to string
            let totalInYourSetsString = totalInYourSetsArray.toString();

            //return all the set numbers for a specific moc
            res.json({
                totalInYourSetsString
            });
        })
        .catch(function (err) {
            console.error(err);
            res.status(500).json({
                message: 'Inventory moc not found'
            });
        });
});

// DELETE ----------------------------------------
// deleting a moc by name
app.delete('/inventory-moc/delete-moc-by-number', function (req, res) {
    console.log(req.body.set_num, req.body.loggedInUserName);
    //if the number of mocs to delete is the same with maxim number of mocs in the inventory, delete the entire moc
    if (req.body.deleteMocMaxQuantityValue == req.body.deleteFromInventoryValue) {

        Moc.deleteMany({
            moc_num: req.body.set_num,
            loggedInUserName: req.body.loggedInUserName
        }).exec().then(function (entry) {
            deleteALLPartsCorrespondingWithDeletedSetsOrMocs(req.body.set_num, req.body.loggedInUserName);
            console.log("done", entry.deletedCount);
            res.status(200).json(entry.deletedCount);

        }).catch(function (err) {
            console.log("delete all MOCs fail");
            return {
                message: err
            };
        });

    }
    // otherwise update only the quantity
    else {

        Moc.deleteMany({
            _id: req.body.deleteMocIDValue
        }).exec().then(function (items) {
            deleteSOMEPartsCorrespondingWithDeletedSetsOrMocs("moc", req.body.deleteMocIDValue, req.body.loggedInUserName);
            res.status(200).json(items);
        }).catch(function (err) {
            console.log("delete only some MOCs fail");
            return {
                message: err
            };
        });
        //
        //        Moc.update({
        //            _id: req.body.deleteMocIDValue
        //        }, {
        //            $set: {
        //                quantity: (req.body.deleteMocMaxQuantityValue - req.body.deleteFromInventoryValue)
        //            }
        //        }, function (items) {
        //            res.status(201).json(items);
        //        });
    }
});



//=============== PART api endpoints=======================================================

// PUT --------------------------------------
app.put('/inventory-part/update-permanent-build', function (req, res) {
    let toUpdate = {};

    let updateableFields = ['part_name', 'permanent_build'];
    updateableFields.forEach(function (field) {
        if (field in req.body) {
            toUpdate[field] = req.body[field];
        }
    });
    //console.log(toUpdate);
    //permanent_build
    Part
        .updateMany({
            part_name: req.body.part_name
        }, {
            $set: {
                permanent_build: req.body.permanent_build
            }
        }).exec().then(function (updated_part) {
            return res.status(204).json({
                updated_part: updated_part
            });
        }).catch(function (err) {
            return res.status(500).json({
                message: 'Updating the permanent build failed'
            });
        });
});

app.put('/inventory-part/add-storage-bin', function (req, res) {
    let toUpdate = {};
    let updateableFields = ['part_num', 'storage_location'];
    updateableFields.forEach(function (field) {
        if (field in req.body) {
            toUpdate[field] = req.body[field];
        }
    });
    //console.log(toUpdate);
    //permanent_build
    Part
        .updateMany({
            part_num: req.body.part_num
        }, {
            $set: {
                storage_location: req.body.storage_location
            }
        }).exec().then(function (updated_part) {
            return res.status(204).json({
                updated_part: updated_part
            });
        }).catch(function (err) {
            return res.status(500).json({
                message: 'Updating the storage location failed'
            });
        });
});

// GET ------------------------------------
// accessing all of a user's items
app.get('/inventory-part/show-aggregate/:username', function (req, res) {
    // retrieve distinct parts (search all the parts for the existing username, sort them by name (ascending) and show only one instance of each)
    Part
        .aggregate(
        [
                {
                    $match: {
                        loggedInUserName: req.params.username,
                    }
            },

                {
                    $group: {
                        _id: {
                            part_num: "$part_num",
                            part_name: "$part_name"
                        },
                        count: {
                            $sum: 1
                        }
                    }
            },

                {
                    $sort: {
                        "_id.part_name": 1
                    }
                }
            ]
        )
        .sort('part_name')
        .then(function (parts) {
            res.json({
                parts
            });
        })
        .catch(function (err) {
            console.error(err);
            res.status(500).json({
                message: 'Inventory part not found'
            });
        });
});

app.get('/inventory-part/show-details/:username/:partNumber', function (req, res) {
    // retrieve all parts
    Part
        .find({
            loggedInUserName: req.params.username,
            part_num: req.params.partNumber
        })
        .sort('part_name')
        .then(function (parts) {
            res.json({
                parts
            });
        })
        .catch(function (err) {
            console.error(err);
            res.status(500).json({
                message: 'Inventory part not found'
            });
        });
});
app.get('/inventory-part/count/:username/:itemNumber', function (req, res) {

    Part
        .find({
            loggedInUserName: req.params.username,
            part_num: req.params.itemNumber
        })
        .sort('-addedToDB')
        .then(function (results) {
            //create a totalQuantity variable
            let totalQuantity = 0;
            let totalAvailable = 0;
            let totalInWishList = 0;
            //loop through the entire array of parts ...
            for (let i = 0; i < results.length; i++) {
                //... and sum up the quantities for them
                totalQuantity = totalQuantity + parseInt(results[i].quantity);

                //if the part is not permanent build ...
                if (parseInt(results[i].permanent_build) == 0) {
                    //... count it as available
                    totalAvailable = totalAvailable + parseInt(results[i].quantity);
                }

                //if the part is in the wishlist ...
                if (parseInt(results[i].in_wishlist) == 1) {
                    //... count it
                    totalInWishList = totalInWishList + parseInt(results[i].quantity);
                }
            }

            //console.log(req.params.itemNumber, totalQuantity, totalAvailable, totalInWishList);
            //return the sum of all quantities for a specific part
            res.json({
                totalQuantity,
                totalAvailable,
                totalInWishList
            });
        })
        .catch(function (err) {
            console.error(err);
            res.status(500).json({
                message: 'Inventory part not found'
            });
        });
});

app.get('/inventory-part/get-in-your-sets/:username/:itemNumber', function (req, res) {

    Part
        .find({
            loggedInUserName: req.params.username,
            part_num: req.params.itemNumber
        })
        .sort('-addedToDB')
        .then(function (results) {
            //create a totalInYourSetsArray array
            let totalInYourSetsArray = [];
            //count the number of unique items added to the array
            let arrayCounter = 0;
            //loop through the entire array of parts ...
            for (let i = 0; i < results.length; i++) {
                //if the set_numb is not part of initial array ...
                if (totalInYourSetsArray.indexOf(results[i].set_num) == -1) {
                    //... add it
                    totalInYourSetsArray[arrayCounter] = results[i].set_num;
                    // ... and increment the number of unique items added to the array
                    arrayCounter++;
                }
            }
            //convert the array to string
            let totalInYourSetsString = totalInYourSetsArray.toString();

            //return all the set numbers for a specific part
            res.json({
                totalInYourSetsString
            });
        })
        .catch(function (err) {
            console.error(err);
            res.status(500).json({
                message: 'Inventory part not found'
            });
        });
});

// DELETE ----------------------------------------
// deleting a part by name
//bookmark - delete only parts that not inside the mocs and sets
app.delete('/inventory-part/delete-part-by-name', function (req, res) {
    Part.deleteMany({
        part_name: req.body.part_name
    }).exec().then(function (entry) {
        return res.status(204).end();
    }).catch(function (err) {
        return res.status(500).json({
            message: 'Internal Server Error'
        });
    });
});

app.delete('/inventory-part/delete-part-by-id', function (req, res) {

    //if the number of parts to delete is the same with maxim number of parts in the inventory, delete the entire part
    if (req.body.deletePartMaxQuantityValue == req.body.deleteFromInventoryValue) {
        Part.findByIdAndRemove(req.body.deletePartIDValue, function (err, items) {
            if (err)
                return res.status(404).json({
                    message: 'Item not found.'
                });

            res.status(201).json(items);
        });
    }
    // otherwise update only the quantity
    else {
        Part.update({
            _id: req.body.deletePartIDValue
        }, {
            $set: {
                quantity: (req.body.deletePartMaxQuantityValue - req.body.deleteFromInventoryValue)
            }
        }, function (items) {
            res.status(201).json(items);
        });
    }
});









app.get('/entry-read/:user', function (req, res) {

    Entry
        .find({
            "entryType": "read"
        })
        .sort('inputDate')
        .then(function (entries) {
            let entriesOutput = [];
            entries.map(function (entry) {
                if (entry.loggedInUserName == req.params.user) {
                    entriesOutput.push(entry);
                }
            });
            res.json({
                entriesOutput
            });
        })
        .catch(function (err) {
            console.error(err);
            res.status(500).json({
                message: 'Internal server error'
            });
        });
});
app.get('/entry-seen/:user', function (req, res) {

    Entry
        .find({
            "entryType": "seen"
        })
        .sort('inputDate')
        .then(function (entries) {
            let entriesOutput = [];
            entries.map(function (entry) {
                if (entry.loggedInUserName == req.params.user) {
                    entriesOutput.push(entry);
                }
            });
            res.json({
                entriesOutput
            });
        })
        .catch(function (err) {
            console.error(err);
            res.status(500).json({
                message: 'Internal server error'
            });
        });
});
app.get('/entry-performed/:user', function (req, res) {

    Entry
        .find({
            "entryType": "performed"
        })
        .sort('inputDate')
        .then(function (entries) {
            let entriesOutput = [];
            entries.map(function (entry) {
                if (entry.loggedInUserName == req.params.user) {
                    entriesOutput.push(entry);
                }
            });
            res.json({
                entriesOutput
            });
        })
        .catch(function (err) {
            console.error(err);
            res.status(500).json({
                message: 'Internal server error'
            });
        });
});

// accessing a single achievement by id
app.get('/entry/:id', function (req, res) {
    Entry
        .findById(req.params.id).exec().then(function (entry) {
            return res.json(entry);
        })
        .catch(function (entries) {
            console.error(err);
            res.status(500).json({
                message: 'Internal Server Error'
            });
        });
});



// MISC ------------------------------------------
// catch-all endpoint if client makes request to non-existent endpoint
app.use('*', (req, res) => {
    res.status(404).json({
        message: 'Not Found'
    });
});

exports.app = app;
exports.runServer = runServer;
exports.closeServer = closeServer;
