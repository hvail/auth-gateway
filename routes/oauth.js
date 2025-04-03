var express = require('express');
var router = express.Router();

router.get('/callback', function (req, res, next) {
    console.log(req.query);
    console.log(req.body);
    res.send({ "msg": "ok" })
});

module.exports = router;
