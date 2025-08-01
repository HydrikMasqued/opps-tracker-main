const axios = require('axios');
const cheerio = require('cheerio');

async function fetchPlayerNames(serverId) {
    try {
        const url = `https://servers.fivem.net/servers/detail/${serverId}`;
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36'
            }
        });

        const html = response.data;
        const $ = cheerio.load(html);

        const players = [];
        $('.player').each((i, element) => {
            const playerName = $(element).find('.player-name').text().trim();
            if (playerName) {
                players.push(playerName);
            }
        });

        return players;
    } catch (error) {
        console.error('Error fetching player names:', error.message);
        return [];
    }
}

(async () => {
    const playerNames = await fetchPlayerNames('pz8m77');
    console.log('Player Names:', playerNames);
})();
