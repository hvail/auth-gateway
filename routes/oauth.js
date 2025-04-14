var express = require('express');
var router = express.Router();
// var fetch = require('node-fetch');
// import fetch from 'node-fetch';

var client_ids = [
    {
        client_id: 'ai-manager-client-dev',
        client_secret: 'ai@choco',
        redirect_uri: 'http://192.168.1./oauth/callback'
    }, {
        client_id: 'ai-manager-client',
        client_secret: 'ai_choco',
        redirect_uri: 'https://iot.hunanxiaoya.com/oauth/login'
    }
]

router.get('/login', async (req, res, next) => {
    console.log(req.query);
    let { code, state, error } = req.query;
    let { client_id, client_secret, redirect_uri } = client_ids.find(item => item.client_id === 'ai-manager-client') || {};
    if (error) {
        console.log(error);
        return res.status(500).send({ "msg": error });
    }
    if (!code || code.length < 1) {
        return res.status(500).send({ "msg": "no code" });
    }

    let response = await fetch('https://oauth2.hunanxiaoya.com/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(`${client_id}:${client_secret}`).toString('base64')
        },
        body: `grant_type=authorization_code&code=${code}&redirect_uri=${redirect_uri}`
    });
    let data = await response.json();
    res.render('oauth', { data: JSON.stringify(data) });
});

router.get('/logout', async (req, res, next) => {
    res.render('logout')
})

module.exports = router;
