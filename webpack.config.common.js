const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: './src/index',
    output: {
        path: path.resolve(__dirname, 'public'),
        filename: '[name].[contenthash].js'
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.json']
    },
    module: {
        rules: [{
            // Include ts, tsx, js, and jsx files.
            test: /\.(ts|jns)x?$/,
            exclude: /node_modules/,
            loader: 'babel-loader',
        }],
    },
    plugins: [
        new CleanWebpackPlugin({
            cleanOnceBeforeBuildPatterns: [
                '**/*',
                '!robots.txt'
            ],
        }),
        new HtmlWebpackPlugin(),
    ],
};
