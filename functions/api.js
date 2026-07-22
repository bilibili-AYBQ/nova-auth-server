const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ========== 用户数据文件（纯文本） ==========
const DATA_FILE = '/tmp/users.txt';

// 初始化文件（如果不存在）
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '');
}

// ========== 读写函数 ==========
function readUsersFromFile() {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    if (!content.trim()) return [];
    return content.split('\n')
        .filter(line => line.trim())
        .map(line => {
            const [username, passwordHash] = line.split('|');
            return { username, passwordHash };
        });
}

function writeUsersToFile(users) {
    const content = users
        .map(u => `${u.username}|${u.passwordHash}`)
        .join('\n');
    fs.writeFileSync(DATA_FILE, content);
}

// ========== 硬编码管理员 ==========
const ADMIN_USER = '阿颜棒球';
const ADMIN_PASS = '#ngGuUzbJZXUt@ICRIR06#cHYFUXTJ';

// ========== API 路由 ==========

// 登录验证
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    // 先检查管理员
    if (username === ADMIN_USER && password === ADMIN_PASS) {
        return res.json({ success: true, message: '管理员登录成功', role: 'admin' });
    }
    const users = readUsersFromFile();
    const user = users.find(u => u.username === username);
    if (!user) {
        return res.status(401).json({ success: false, message: '用户名不存在' });
    }
    if (!bcrypt.compareSync(password, user.passwordHash)) {
        return res.status(401).json({ success: false, message: '密码错误' });
    }
    res.json({ success: true, message: '登录成功', role: 'user' });
});

// 注册（新用户）
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }
    if (username === ADMIN_USER) {
        return res.status(409).json({ success: false, message: '用户名已被占用' });
    }
    let users = readUsersFromFile();
    if (users.find(u => u.username === username)) {
        return res.status(409).json({ success: false, message: '用户名已存在' });
    }
    const passwordHash = bcrypt.hashSync(password, 10);
    users.push({ username, passwordHash });
    writeUsersToFile(users);
    res.json({ success: true, message: '注册成功' });
});

// 获取所有用户（仅显示用户名）
app.get('/api/users', (req, res) => {
    const users = readUsersFromFile().map(u => ({ username: u.username }));
    res.json(users);
});

// 删除用户
app.post('/api/delete', (req, res) => {
    const { username } = req.body;
    if (username === ADMIN_USER) {
        return res.status(403).json({ success: false, message: '不能删除管理员账号' });
    }
    let users = readUsersFromFile();
    const index = users.findIndex(u => u.username === username);
    if (index === -1) {
        return res.status(404).json({ success: false, message: '用户不存在' });
    }
    users.splice(index, 1);
    writeUsersToFile(users);
    res.json({ success: true, message: '删除成功' });
});

// 修改密码
app.post('/api/change-password', (req, res) => {
    const { username, oldPassword, newPassword } = req.body;
    if (username === ADMIN_USER) {
        return res.status(403).json({ success: false, message: '管理员密码不可修改' });
    }
    let users = readUsersFromFile();
    const user = users.find(u => u.username === username);
    if (!user) {
        return res.status(404).json({ success: false, message: '用户不存在' });
    }
    if (!bcrypt.compareSync(oldPassword, user.passwordHash)) {
        return res.status(401).json({ success: false, message: '原密码错误' });
    }
    user.passwordHash = bcrypt.hashSync(newPassword, 10);
    writeUsersToFile(users);
    res.json({ success: true, message: '密码修改成功' });
});

// ========== 导出 ==========
exports.handler = serverless(app);