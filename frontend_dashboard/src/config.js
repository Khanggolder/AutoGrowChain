const host = window.location.hostname;

export const API = {
    ESP: 'http://192.168.4.1',
    SUPPLY: `http://${host}:3000/api`,
    TPL: `http://${host}:3005/api`,
    AI: `http://${host}:8000`,
    DATA: `http://${host}:3010/api`
};


