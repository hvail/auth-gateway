var express = require('express');
var router = express.Router();

var authorize_host = 'https://oauth2.zshaojie.com';

var state_map = new Map();

var client_ids = [
    {
        client_id: 'ai-manager-client-dev',
        client_secret: 'ai@choco',
        redirect_uri: 'http://localhost:8848/oauth/callback',
        client_redirect_uri: 'http://localhost:8848/oauth/login',
        logout_redirect_uri: 'http://localhost:8848/oauth/logout',
    },
    {
        client_id: 'ai-manager-client',
        client_secret: 'ai_choco',
        redirect_uri: 'http://ai.hrm2m.com/oauth/callback',
        client_redirect_uri: 'http://ai.hrm2m.com/oauth/login',
        logout_redirect_uri: 'http://ai.hrm2m.com/oauth/logout'
    },
    {
        client_id: 'oauth-express-simple-3',
        client_secret: 'demo@2025',
        redirect_uri: 'http://localhost:3000/oauth/callback'
    // }, {
    //     client_id: 'ai-manager-client',
    //     client_secret: 'ai_choco',
    //     redirect_uri: 'https://iot.hunanxiaoya.com/login/callback'
    }
]

router.get('/logout', (req, res, next) => {
    let { oauth_data } = req.cookies;
    console.log("logout oauth_data:", oauth_data);
    if (oauth_data) {
        let { state } = JSON.parse(oauth_data);
        state_map.delete(state);
        res.clearCookie('oauth_data', { path: '/' });
        res.redirect('/');
    }
});

router.get('/authorize', (req, res, next) => { 
    let {client_id} = req.query;
    console.log("authorize params:", req.query);
    let state = Math.random().toString(36).slice(2);
    state_map.set(state, { timestamp: Date.now(), client_id: client_id });
    let { redirect_uri } = client_ids.find(item => item.client_id === client_id) || {};
    res.redirect(`${authorize_host}/oauth2/authorize?state=${state}&response_type=code&client_id=${client_id}&redirect_uri=${redirect_uri}&scope=openid device`);``
});

router.get('/callback', async (req, res, next) => {
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
    let response = await fetch(`${authorize_host}/oauth2/token`, requestOptions);
    let data = await response.json();
    console.log(data);
    let {access_token, id_token, refresh_token, token_type, expires_in, scope} = data;

    try {
        const maxAge = (expires_in ? Number(expires_in) * 1000 : 24 * 60 * 60 * 1000);
        res.cookie('oauth_data', JSON.stringify({ access_token, id_token, refresh_token, token_type, expires_in, scope, state }), {
            httpOnly: true,
            secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
            sameSite: 'Lax',
            maxAge,
            path: '/'
        });
    } catch (err) {
        console.error('Failed to set oauth cookie', err);
    }

    res.redirect(`${client_redirect_uri}?access_token=${access_token}&id_token=${id_token}&scope=${scope}`);
});

module.exports = router;
