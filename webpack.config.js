const path = require('path');
const Dotenv = require('dotenv-webpack');

module.exports = {
    entry: './src/index',
    output: {
        path: path.resolve(__dirname, 'public'),
        filename: 'index.js'
    },
    optimization:{
      minimize: false
    },
    devtool: "hidden-source-map",
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.json']
    },
    plugins: [
        new Dotenv()
    ],
    module: {
        rules: [{
            // Include ts, tsx, js, and jsx files.
            test: /\.(ts|js)x?$/,
            exclude: /node_modules/,
            loader: 'babel-loader',
        }],
    }
};
