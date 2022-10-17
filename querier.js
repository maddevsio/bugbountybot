
const Bluebird = require('bluebird');
const fetch = require('node-fetch');
fetch.Promise = Bluebird;
const reportsQuery = require('./query.graphql'); 

class Querier {
    constructor(config = {}) {
        this.config = config;
    }

    async queryReports(variables) {
        const res = await fetch('https://hackerone.com/hacktivity');
        const html = await res.text();
        const csrfMeta = html.match(/<meta name="csrf-token" content="*[^>]*>/)[0];
        const cookie = res.headers.get('set-cookie');
        const csrfToken = csrfMeta.match(/content="([^"]*)/)[1];
        
        const params = {
            query: reportsQuery,
            variables
        }
        return fetch(this.config.uri, {
                headers: {
                    'Content-Type': 'application/json',
                    'cookie': cookie,
                    'x-csrf-token': csrfToken
                },
                method: 'POST',
                body: JSON.stringify(params)
            })
            .then(res => res.json());
    }
}

module.exports = Querier;