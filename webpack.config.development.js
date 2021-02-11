const { merge } = require("webpack-merge");
const common = require('./webpack.config.common.js');
const Dotenv = require('dotenv-webpack');

module.exports = merge(common, {
    mode: 'development',
    devtool: "inline-source-map",
    optimization:{
        minimize: false
    },
    plugins: [
        new Dotenv({ path: "./.env.development" })
    ],
});
