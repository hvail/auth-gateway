var express = require('express');
var router = express.Router();

var authorize_host = 'https://oauth2.zshaojie.com';

var state_map = new Map();

var client_ids = [
    {
        client_id: 'ai-manager-client-dev',
        client_secret: 'ai@choco',
        redirect_uri: 'http://localhost:8848/oauth/callback',
        client_redirect_uri: 'http://localhost:8848/oauth/login'
    },
    {
        client_id: 'ai-manager-client',
        client_secret: 'ai_choco',
        redirect_uri: 'http://ai.hrm2m.com/oauth/callback',
        client_redirect_uri: 'http://ai.hrm2m.com/oauth/login'
    },
    {
        client_id: 'oauth-express-simple-3',
        client_secret: 'demo@2025',
        redirect_uri: 'http://localhost:3000/oauth/callback'
    }, {
        client_id: 'ai-manager-client',
        client_secret: 'ai_choco',
        redirect_uri: 'https://iot.hunanxiaoya.com/login/callback'
    }
]

router.get('/authorize', (req, res, next) => { 
    let {client_id} = req.query;
    console.log("authorize params:", req.query);
    let state = Math.random().toString(36).slice(2);
    state_map.set(state, { timestamp: Date.now(), client_id: client_id });
    let { redirect_uri } = client_ids.find(item => item.client_id === client_id) || {};
    res.redirect(`${authorize_host}/oauth2/authorize?state=${state}&response_type=code&client_id=${client_id}&redirect_uri=${redirect_uri}&scope=openid device`);``
});

router.get('/callback', async (req, res, next) => {
    // console.log(req.query);
    let { code, state, error } = req.query;
    let client_info = state_map.get(state) || {};
    let { client_id, client_secret, redirect_uri, client_redirect_uri } = client_ids.find(item => item.client_id === client_info.client_id) || {};
    console.log("callback params:", req.query);
    console.log("client info:", { client_id, redirect_uri });
    if (error) {
        console.log(error);
        return res.status(500).send({ "msg": error });
    }
    if (!code || code.length < 1) {
        return res.status(500).send({ "msg": "no code" });
    }

    var requestOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(`${client_id}:${client_secret}`).toString('base64')
        },
        body: `grant_type=authorization_code&code=${code}&redirect_uri=${redirect_uri}`
    }
    console.log("requestOptions", requestOptions);
    let response = await fetch(`${authorize_host}/oauth2/token`, requestOptions);
    console.log(response);
    let data = await response.json();
    console.log(data);
    let {access_token, id_token, refresh_token, token_type, expires_in, scope} = data;
    res.redirect(`${client_redirect_uri}?access_token=${access_token}&id_token=${id_token}&scope=${scope}`);

    // res.render('oauth', { msg: JSON.stringify(data), data: data });
});

module.exports = router;
