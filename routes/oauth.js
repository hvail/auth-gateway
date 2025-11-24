var express = require('express');
const { createClient } = require('redis');
const RedisClient = require('../server/redisClient');

var router = express.Router();

var authorize_host = 'https://oauth2.zshaojie.com';

var redisClient = new RedisClient();

var client_ids = [
    {
        client_id: 'ai-manager-client-dev',
        client_secret: 'ai@choco',
        redirect_uri: 'http://localhost:8848/oauth/callback',
        client_redirect_uri: 'http://localhost:8848/',
        logout_redirect_uri: 'http://localhost:8848/oauth/logout',
    },
    {
        client_id: 'ai-manager-client',
        client_secret: 'ai_choco',
        redirect_uri: 'http://ai.hrm2m.com/oauth/callback',
        client_redirect_uri: 'http://ai.hrm2m.com/',
        logout_redirect_uri: 'http://ai.hrm2m.com/oauth/logout'
    },
    {
        client_id: 'oauth-express-simple-3',
        client_secret: 'demo@2025',
        redirect_uri: 'http://localhost:3000/oauth/callback'
    }
]

router.get('/logout', async (req, res, next) => {
    let { oauth_data, oauth_state } = req.cookies;
    let { state, redirect_uri, id_token_hint } = req.query;
    console.log("state:", state || oauth_state);
    if (!state && !id_token_hint) {
        if (oauth_data) {
            let { state } = JSON.parse(oauth_data);
            res.clearCookie('oauth_data', { path: '/' });
            res.clearCookie('oauth_state', { path: '/' });
            let web_redirect_url = await redisClient.get(`oauth:${oauth_state}:logout:redirect_url`);
            // 删除Redis中的Token信息
            await redisClient.set(`oauth:${oauth_state}:client_id`, '', { EX: 1 });
            await redisClient.set(`oauth:${oauth_state}:data`, '', { EX: 1 });
            await redisClient.set(`oauth:${oauth_state}:client`, '', { EX: 1 });
            await redisClient.set(`oauth:${oauth_state}:refresh`, '', { EX: 1 });
            console.log("redirect to:", web_redirect_url || '/');
            res.redirect(web_redirect_url || '/');
            return;
        }
    } else if (state) {
        console.log("logout by state params:", req.query);
        let client_id = await redisClient.get(`oauth:${state}:client_id`);
        let oauth_data_end = await redisClient.getJSON(`oauth:${state}:data`);
        if (oauth_data_end) {
            let { id_token, refresh_token } = oauth_data_end;
            let { logout_redirect_uri } = client_ids.find(item => item.client_id === client_id) || {};
            if (redirect_uri) {
                await redisClient.set(`oauth:${state}:logout:redirect_url`, redirect_uri, { EX: 60 });
            }
            console.log("redirect to logout url:", `${authorize_host}/connect/logout?id_token_hint=${id_token}&post_logout_redirect_uri=${logout_redirect_uri}`);
            res.redirect(`${authorize_host}/connect/logout?id_token_hint=${id_token}&post_logout_redirect_uri=${logout_redirect_uri}`);
            return;
        }
    } else if (id_token_hint) {
        res.redirect(`${authorize_host}/connect/logout?id_token_hint=${id_token_hint}`);
        return;
    }
    // 返回失败
    res.send({ "msg": "state not found or invalid" });
});

router.post('/refresh', async (req, res, next) => {
    let state = req.cookies['oauth_state']
    // data 有可能已经过期，所以没必要获取到
    // let data = req.cookies['oauth_data']
    let _client_id = await redisClient.get(`oauth:${state}:client_id`);
    let _refresh_token = await redisClient.get(`oauth:${state}:refresh`);
    let { client_secret, redirect_uri } = client_ids.find(item => item.client_id === _client_id) || {};
    console.log("refresh token params:", { state, _client_id, _refresh_token });
    var requestOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(`${_client_id}:${client_secret}`).toString('base64')
        },
        body: `grant_type=refresh_token&refresh_token=${_refresh_token}`
    }
    let response = await fetch(`${authorize_host}/oauth2/token`, requestOptions);
    let data = await response.json();
    console.log("refresh token response:", data);
    if (data.error) {
        return res.status(500).send({ "msg": data.error_description || 'token exchange failed' });
    }

    try {
        const ttlSeconds = data.expires_in ? Number(data.expires_in) : 24 * 60 * 60;
        console.log("ttl:", ttlSeconds);
        await redisClient.set(`oauth:${state}:data`, JSON.stringify(data), { EX: ttlSeconds });
        await redisClient.set(`oauth:${state}:client`, data.access_token, { EX: ttlSeconds });
        await redisClient.set(`oauth:${state}:refresh`, data.refresh_token, { EX: 7 * 24 * 3600 });
        await redisClient.set(`oauth:${state}:client_id`, _client_id, { EX: 3600 * 24 * 7 });

    } catch (err) {
        console.error('Failed to save oauth data to redis', err);
    }
    let { access_token, id_token, token_type, expires_in, scope } = data;

    try {
        const maxAge = (expires_in ? Number(expires_in) * 1000 : 24 * 60 * 60 * 1000);
        var cookieOptions = {
            httpOnly: false,
            secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
            sameSite: 'Lax',
            maxAge,
            path: '/'
        };
        res.cookie('oauth_data', JSON.stringify({ access_token, id_token, token_type, expires_in, scope, state }), cookieOptions);
        res.cookie('oauth_state', state, { ...cookieOptions, maxAge: 86400 * 7 * 1000 });
        return res.status(200).send({ "msg": "token refreshed", "state": state });
    } catch (err) {
        console.error('Failed to set oauth cookie', err);
        return res.status(500).send({ "msg": "failed to set oauth cookie" });
    }

});

router.get('/authorize', async (req, res, next) => {
    let { client_id, state } = req.query;
    if (state) {
        // 如果有state参数，那就读取state对应的refresh_token，然后重新请求token
        let refresh_token = await redisClient.get(`oauth:${state}:refresh`);
        let client_id_stored = await redisClient.get(`oauth:${state}:client_id`);
        // if (client_id_stored == client_id) {
        //     let { access_token, refresh_token } = await oauth.refreshToken(client_id, refresh_token);
        //     res.redirect(`${process.env.CLIENT_URL}/#/oauth/callback?access_token=${access_token}&refresh_token=${refresh_token}&state=${state}`);
        // }
    }
    console.log("authorize params:", req.query);
    let _state = Math.random().toString(36).slice(2);
    await redisClient.set(`oauth:${_state}:client_id`, client_id, { EX: 3600 * 24 });
    let { redirect_uri } = client_ids.find(item => item.client_id === client_id) || {};
    res.redirect(`${authorize_host}/oauth2/authorize?state=${_state}&response_type=code&client_id=${client_id}&redirect_uri=${redirect_uri}&scope=openid device`); ``
});

router.get('/callback', async (req, res, next) => {
    let { code, state, error } = req.query;
    let client_id = await redisClient.get(`oauth:${state}:client_id`);
    let { client_secret, redirect_uri, client_redirect_uri } = client_ids.find(item => item.client_id === client_id) || {};
    console.log("callback params:", req.query);
    console.log("client info:", { client_id, client_secret, redirect_uri });
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
        // body: `grant_type=authorization_code&code=${code}&redirect_uri=${redirect_uri}`
        body: `grant_type=authorization_code&code=${code}&redirect_uri=${redirect_uri}`
    }
    console.log("request options:", requestOptions);
    let response = await fetch(`${authorize_host}/oauth2/token`, requestOptions);
    let data = await response.json();
    console.log(data);
    if (data.error) {
        return res.status(500).send({ "msg": data.error_description || 'token exchange failed' });
    }
    try {
        const ttlSeconds = data.expires_in ? Number(data.expires_in) : 24 * 60 * 60;
        console.log("ttl:", ttlSeconds);
        await redisClient.set(`oauth:${state}:data`, JSON.stringify(data), { EX: ttlSeconds });
        await redisClient.set(`oauth:${state}:client`, data.access_token, { EX: ttlSeconds });
        await redisClient.set(`oauth:${state}:refresh`, data.refresh_token, { EX: 7 * 24 * 3600 });
        await redisClient.set(`oauth:${state}:client_id`, client_id, { EX: 3600 * 24 * 7 });

    } catch (err) {
        console.error('Failed to save oauth data to redis', err);
    }
    let { access_token, id_token, token_type, expires_in, scope } = data;

    try {
        const maxAge = (expires_in ? Number(expires_in) * 1000 : 24 * 60 * 60 * 1000);

        var cookieOptions = {
            httpOnly: false,
            secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
            sameSite: 'Lax',
            maxAge,
            path: '/'
        };

        res.cookie('oauth_data', JSON.stringify({ access_token, id_token, token_type, expires_in, scope, state }), cookieOptions);
        res.cookie('oauth_state', state, { ...cookieOptions, maxAge: 86400 * 7 * 1000 });

    } catch (err) {
        console.error('Failed to set oauth cookie', err);
    }

    console.log("redirect to:", client_redirect_uri);
    res.redirect(`${client_redirect_uri}`);

});

module.exports = router;
