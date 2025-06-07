const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// 设置静态文件中间件
app.use(express.static(__dirname));

// 设置正确的 MIME 类型
app.use((req, res, next) => {
    if (req.path.endsWith('.html')) {
        res.setHeader('Content-Type', 'text/html');
    } else if (req.path.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
    } else if (req.path.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
    }
    next();
});

// 根路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 捕获所有其他路由
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).send('服务器错误');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ 服务器运行在端口 ${PORT}`);
    console.log(`📁 静态文件目录: ${__dirname}`);
    console.log(`🌐 访问地址: http://localhost:${PORT}`);
});
