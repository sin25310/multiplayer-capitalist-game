const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        features: ['采集系统', '地牢探险', '技能系统', '装备系统']
    });
});

// 游戏状态
const gameState = {
    companies: new Map(),
    globalRecruitPool: [],
    chatMessages: [],
    worldEvents: [],
    serverStartTime: Date.now(),
    dailyEvents: []
};

// 种族和职业配置（与前端保持一致）
const races = {
    human: { name: '人类', emoji: '👤', bonuses: { intelligence: 5, dexterity: 5 } },
    elf: { name: '精灵', emoji: '🧝', bonuses: { magic: 10, intelligence: 5 } },
    dwarf: { name: '矮人', emoji: '🧔', bonuses: { strength: 10, constitution: 5 } },
    orc: { name: '兽人', emoji: '👹', bonuses: { strength: 15, constitution: 10 } },
    halfling: { name: '半身人', emoji: '🧒', bonuses: { dexterity: 10, luck: 10 } },
    dragon: { name: '龙族', emoji: '🐲', bonuses: { magic: 20, strength: 10 } },
    angel: { name: '天使', emoji: '👼', bonuses: { magic: 15, intelligence: 10 } },
    demon: { name: '恶魔', emoji: '😈', bonuses: { magic: 15, strength: 10 } }
};

const jobs = {
    warrior: { name: '战士', emoji: '⚔️', primaryStat: 'strength', skills: ['combat', 'defense'] },
    mage: { name: '法师', emoji: '🧙', primaryStat: 'magic', skills: ['spellcasting', 'enchanting'] },
    scholar: { name: '学者', emoji: '📚', primaryStat: 'intelligence', skills: ['research', 'analysis'] },
    rogue: { name: '盗贼', emoji: '🗡️', primaryStat: 'dexterity', skills: ['stealth', 'lockpicking'] },
    engineer: { name: '工程师', emoji: '🔧', primaryStat: 'intelligence', skills: ['construction', 'repair'] },
    healer: { name: '治疗师', emoji: '💊', primaryStat: 'magic', skills: ['healing', 'support'] },
    merchant: { name: '商人', emoji: '💰', primaryStat: 'charisma', skills: ['trading', 'negotiation'] },
    artisan: { name: '工匠', emoji: '🔨', primaryStat: 'dexterity', skills: ['crafting', 'creation'] }
};

const traits = {
    positive: [
        { name: '勤奋', effect: '工作效率+20%' },
        { name: '天才', effect: '学习速度+30%' },
        { name: '坚韧', effect: '体力消耗-15%' },
        { name: '幸运', effect: '任务成功率+10%' },
        { name: '领袖', effect: '团队效率+15%' },
        { name: '专注', effect: '研究效率+25%' },
        { name: '勇敢', effect: '战斗效率+20%' },
        { name: '魔法亲和', effect: '魔法效率+30%' }
    ],
    negative: [
        { name: '懒惰', effect: '工作效率-15%' },
        { name: '胆小', effect: '战斗效率-20%' },
        { name: '暴躁', effect: '情绪波动+50%' },
        { name: '贪婪', effect: '工资需求+30%' },
        { name: '脆弱', effect: '体力-20%' },
        { name: '健忘', effect: '学习效率-25%' },
        { name: '傲慢', effect: '团队合作-15%' }
    ]
};

console.log('🏢✨ 都市奇幻公司服务器 v2.0 启动中...');
console.log('🆕 新功能: 采集系统、地牢探险、技能系统、装备系统');

// 错误处理
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// 生成随机员工
function generateRandomEmployee() {
    const raceKeys = Object.keys(races);
    const jobKeys = Object.keys(jobs);
    const race = raceKeys[Math.floor(Math.random() * raceKeys.length)];
    const job = jobKeys[Math.floor(Math.random() * jobKeys.length)];
    
    const employee = {
        id: 'emp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        name: generateRandomName(race),
        race: race,
        job: job,
        stats: {
            strength: Math.floor(Math.random() * 60) + 20,
            intelligence: Math.floor(Math.random() * 60) + 20,
            magic: Math.floor(Math.random() * 60) + 20,
            dexterity: Math.floor(Math.random() * 60) + 20,
            charisma: Math.floor(Math.random() * 60) + 20,
            constitution: Math.floor(Math.random() * 60) + 20
        },
        status: {
            mood: Math.floor(Math.random() * 40) + 60,
            energy: Math.floor(Math.random() * 40) + 60,
            health: 100,
            hunger: Math.floor(Math.random() * 30) + 30,
            happiness: Math.floor(Math.random() * 40) + 50
        },
        skills: {},
        equipment: {
            weapon: null,
            armor: null,
            accessory: null
        },
        traits: [],
        needs: [],
        background: generateBackground(),
        salary: Math.floor(Math.random() * 200) + 100,
        currentTask: null,
        taskEndTime: null,
        experience: 0,
        level: 1
    };
    
    // 应用种族加成
    const raceBonus = races[race].bonuses;
    Object.keys(raceBonus).forEach(stat => {
        if (employee.stats[stat]) {
            employee.stats[stat] += raceBonus[stat];
        }
    });
    
    // 初始化职业技能
    const jobSkills = jobs[job].skills;
    jobSkills.forEach(skill => {
        employee.skills[skill] = Math.floor(Math.random() * 30) + 10;
    });
    
    // 随机添加特质
    if (Math.random() < 0.7) {
        const positiveTraits = traits.positive;
        employee.traits.push(positiveTraits[Math.floor(Math.random() * positiveTraits.length)]);
    }
    
    if (Math.random() < 0.3) {
        const negativeTraits = traits.negative;
        employee.traits.push(negativeTraits[Math.floor(Math.random() * negativeTraits.length)]);
    }
    
    // 生成需求
    employee.needs = generateNeeds();
    
    return employee;
}

function generateRandomName(race) {
    const namesByRace = {
        human: ['艾伦', '莉莉', '约翰', '玛丽', '大卫', '艾米', '杰克', '索菲亚', '亚历克斯', '艾玛'],
        elf: ['埃隆迪尔', '加拉德瑞尔', '勒戈拉斯', '阿尔文', '凯兰崔尔', '瑟兰督伊', '精灵王子', '月光女神'],
        dwarf: ['金雳', '巴林', '德瓦林', '朵力', '诺力', '索林', '铁胡子', '石拳'],
        orc: ['格罗什', '乌鲁克', '萨鲁曼', '布格', '鲁格', '高格', '血爪', '铁牙'],
        halfling: ['佛罗多', '山姆', '梅里', '皮平', '比尔博', '罗西', '小脚丫', '胖胖'],
        dragon: ['巴哈姆特', '提亚马特', '金龙王', '红龙女王', '银龙长老', '黑龙君主', '古龙贤者'],
        angel: ['米迦勒', '加百列', '拉斐尔', '乌列', '萨拉菲尔', '拉贵尔', '光之使者'],
        demon: ['阿斯莫德', '贝利亚', '玛门', '利维坦', '萨麦尔', '别西卜', '暗影魔王']
    };
    
    const names = namesByRace[race] || namesByRace.human;
    return names[Math.floor(Math.random() * names.length)];
}

function generateBackground() {
    const backgrounds = [
        '出生在贵族家庭，接受过良好教育',
        '来自平民家庭，通过努力获得技能',
        '曾是冒险者，有丰富的战斗经验',
        '前学者，专注于知识研究',
        '流浪商人，熟悉各地风俗',
        '军队退役，纪律性强',
        '法师学院毕业生',
        '孤儿，自学成才',
        '来自异世界的旅行者',
        '神庙的前祭司',
        '盗贼公会的前成员',
        '王室的失宠贵族',
        '古老种族的后裔',
        '被诅咒的流浪者',
        '魔法实验的幸存者',
        '传说中英雄的后代',
        '神秘组织的叛逃者',
        '时空旅行者',
        '失忆的强者',
        '预言中的天选之人'
    ];
    
    return backgrounds[Math.floor(Math.random() * backgrounds.length)];
}

function generateNeeds() {
    const needTypes = ['食物', '休息', '娱乐', '社交', '安全感', '成就感', '自由', '奢侈品'];
    const needs = [];
    const needCount = Math.floor(Math.random() * 3) + 2;
    
    for (let i = 0; i < needCount; i++) {
        const needType = needTypes[Math.floor(Math.random() * needTypes.length)];
        const urgency = Math.random() < 0.2 ? 'urgent' : 'normal';
        
        if (!needs.find(n => n.type === needType)) {
            needs.push({
                type: needType,
                urgency: urgency,
                satisfaction: Math.floor(Math.random() * 100)
            });
        }
    }
    
    return needs;
}

function addChatMessage(playerName, message) {
    try {
        if (!playerName || !message) return;
        
        const chatMessage = {
            player: String(playerName),
            message: String(message),
            timestamp: Date.now()
        };
        
        gameState.chatMessages.push(chatMessage);
        
        if (gameState.chatMessages.length > 200) {
            gameState.chatMessages.shift();
        }
        
        io.emit('chatMessage', chatMessage);
        console.log(`💬 [${playerName}]: ${message}`);
    } catch (error) {
        console.error('❌ addChatMessage error:', error);
    }
}

function triggerWorldEvent() {
    const events = [
        {
            name: '魔法风暴',
            description: '强烈的魔法风暴席卷都市，所有魔法相关活动效率提升50%',
            duration: 300000, // 5分钟
            effects: { magicBonus: 0.5 }
        },
        {
            name: '贸易节',
            description: '年度贸易节开始，所有商业活动收益翻倍',
            duration: 240000, // 4分钟
            effects: { commerceBonus: 1.0 }
        },
        {
            name: '人才流动',
            description: '大量人才涌入都市，招募池刷新并增加稀有人才',
            duration: 180000, // 3分钟
            effects: { recruitBonus: true }
        },
        {
            name: '技术突破',
            description: '科技大突破，所有研究项目效率提升75%',
            duration: 360000, // 6分钟
            effects: { researchBonus: 0.75 }
        },
        {
            name: '经济繁荣',
            description: '都市经济繁荣，所有员工心情和效率提升',
            duration: 420000, // 7分钟
            effects: { moodBonus: 20, efficiencyBonus: 0.3 }
        },
        {
            name: '地牢开启',
            description: '神秘地牢入口出现，冒险奖励翻倍！',
            duration: 480000, // 8分钟
            effects: { dungeonBonus: 1.0 }
        },
        {
            name: '资源丰收',
            description: '采集资源大丰收，所有采集活动产量提升100%',
            duration: 300000, // 5分钟
            effects: { gatheringBonus: 1.0 }
        }
    ];
    
    const event = events[Math.floor(Math.random() * events.length)];
    
    gameState.worldEvents.push({
        ...event,
        startTime: Date.now(),
        endTime: Date.now() + event.duration
    });
    
    addChatMessage('奇幻快讯', `🌟 世界事件：${event.name}！${event.description}`);
    
    // 应用事件效果
    if (event.effects.recruitBonus) {
        // 重新生成招募池，增加稀有人才
        gameState.globalRecruitPool = [];
        for (let i = 0; i < 15; i++) {
            const employee = generateRandomEmployee();
            // 提升属性
            Object.keys(employee.stats).forEach(stat => {
                employee.stats[stat] += Math.floor(Math.random() * 20) + 5;
            });
            gameState.globalRecruitPool.push(employee);
        }
        io.emit('recruitPoolUpdate', gameState.globalRecruitPool);
    }
    
    // 设置事件结束定时器
    setTimeout(() => {
        gameState.worldEvents = gameState.worldEvents.filter(e => e.name !== event.name);
        addChatMessage('奇幻快讯', `${event.name} 事件已结束`);
        console.log(`🌟 世界事件结束: ${event.name}`);
    }, event.duration);
    
    console.log(`🌟 触发世界事件: ${event.name}`);
}

// 初始化全局招募池
function initializeRecruitPool() {
    gameState.globalRecruitPool = [];
    for (let i = 0; i < 20; i++) {
        gameState.globalRecruitPool.push(generateRandomEmployee());
    }
    console.log('👥 初始化招募池完成，生成了20个候选员工');
}

// 获取在线玩家数量
function getOnlineCount() {
    let count = 0;
    gameState.companies.forEach(company => {
        if (company.online) count++;
    });
    return count;
}

// 玩家连接处理
io.on('connection', (socket) => {
    console.log('🔗 新CEO连接:', socket.id);
    
    // 发送在线玩家数量
    socket.emit('onlineCount', getOnlineCount());
    
    socket.on('joinGame', (data) => {
        try {
            const { companyName, playerName, companyType, gameData } = data;
            
            if (!companyName || !playerName) {
                socket.emit('error', { message: '公司名称和玩家名称不能为空' });
                return;
            }
            
            const companyData = {
                id: socket.id,
                name: companyName,
                playerName: playerName,
                companyType: companyType || 'arcane',
                gameData: gameData || createNewCompany(companyType),
                online: true,
                lastSeen: Date.now(),
                socket: socket
            };
            
            gameState.companies.set(socket.id, companyData);
            
            socket.emit('gameState', {
                recruitPool: gameState.globalRecruitPool,
                chatMessages: gameState.chatMessages.slice(-50),
                worldEvents: gameState.worldEvents,
                onlineCount: getOnlineCount()
            });
            
            socket.broadcast.emit('companyJoined', {
                id: socket.id,
                name: companyName
            });
            
            // 广播在线玩家数量更新
            io.emit('onlineCount', getOnlineCount());
            
            addChatMessage('系统', `🏢 ${companyName} 在奇幻都市开业了！欢迎加入这个魔法世界！`);
            console.log(`🏢 公司 ${companyName}(${companyType}) 加入游戏，当前在线: ${getOnlineCount()}`);
        } catch (error) {
            console.error('❌ joinGame error:', error);
            socket.emit('error', { message: '加入游戏失败' });
        }
    });
    
    socket.on('recruitEmployee', (data) => {
        try {
            const { employeeId } = data;
            const company = gameState.companies.get(socket.id);
            
            if (company) {
                // 从全局招募池中移除员工
                const recruitedEmployee = gameState.globalRecruitPool.find(e => e.id === employeeId);
                gameState.globalRecruitPool = gameState.globalRecruitPool.filter(e => e.id !== employeeId);
                
                // 补充一个新员工
                gameState.globalRecruitPool.push(generateRandomEmployee());
                
                // 广播招募池更新
                io.emit('recruitPoolUpdate', gameState.globalRecruitPool);
                
                if (recruitedEmployee) {
                    addChatMessage('人才市场', `🎯 ${company.name} 成功招募了 ${recruitedEmployee.name}(${races[recruitedEmployee.race].name} ${jobs[recruitedEmployee.job].name})！`);
                }
                console.log(`👥 ${company.name} 招募了员工: ${employeeId}`);
            }
        } catch (error) {
            console.error('❌ recruitEmployee error:', error);
        }
    });
    
    socket.on('employeeTaskComplete', (data) => {
        try {
            const { employeeId, taskResult, activityType } = data;
            const company = gameState.companies.get(socket.id);
            
            if (company && taskResult.success) {
                const successMessages = {
                    gathering: [
                        `🌲 ${company.name} 的员工在采集活动中收获丰富！`,
                        `⛏️ ${company.name} 成功完成了资源采集任务！`,
                        `🎣 ${company.name} 的团队展现了出色的采集技能！`
                    ],
                    dungeon: [
                        `⚔️ ${company.name} 的勇士们成功征服了地牢！`,
                        `🏆 ${company.name} 在危险的地牢探险中凯旋归来！`,
                        `💎 ${company.name} 从地牢深处带回了珍贵战利品！`
                    ]
                };
                
                const messages = successMessages[activityType] || successMessages.gathering;
                addChatMessage('冒险快讯', messages[Math.floor(Math.random() * messages.length)]);
            }
        } catch (error) {
            console.error('❌ employeeTaskComplete error:', error);
        }
    });
    
    socket.on('chatMessage', (message) => {
        try {
            const company = gameState.companies.get(socket.id);
            if (company && message && typeof message === 'string') {
                const filteredMessage = message.trim().substring(0, 200);
                if (filteredMessage.length > 0) {
                    addChatMessage(company.name, filteredMessage);
                }
            }
        } catch (error) {
            console.error('❌ chatMessage error:', error);
        }
    });
    
    socket.on('disconnect', () => {
        try {
            const company = gameState.companies.get(socket.id);
            if (company) {
                company.online = false;
                
                socket.broadcast.emit('companyLeft', {
                    id: socket.id,
                    name: company.name
                });
                
                // 广播在线玩家数量更新
                io.emit('onlineCount', getOnlineCount());
                
                addChatMessage('系统', `👋 ${company.name} 暂时离开了都市`);
                console.log(`👋 公司 ${company.name} 断开连接，当前在线: ${getOnlineCount()}`);
                
                // 24小时后删除公司数据
                setTimeout(() => {
                    if (gameState.companies.has(socket.id) && !gameState.companies.get(socket.id).online) {
                        gameState.companies.delete(socket.id);
                        console.log(`🗑️ 清理离线公司数据: ${company.name}`);
                    }
                }, 24 * 60 * 60 * 1000);
            }
        } catch (error) {
            console.error('❌ disconnect error:', error);
        }
    });
    
    socket.on('error', (error) => {
        console.error('❌ Socket error:', error);
    });
});

function createNewCompany(companyType = 'arcane') {
    return {
        resources: {
            money: 5000,
            food: 100,
            materials: 50,
            wood: 30,
            stone: 20,
            fish: 15,
            knowledge: 20,
            magic: 30,
            artifacts: 0
        },
        employees: [],
        facilities: {
            dormitory: 0,
            cafeteria: 0,
            library: 0,
            workshop: 0,
            laboratory: 0,
            armory: 0
        },
        equipment: [],
        companyLevel: 1,
        reputation: 100,
        companyType: companyType
    };
}

// 定期更新招募池
setInterval(() => {
    try {
        // 随机替换一些员工
        if (Math.random() < 0.3) {
            const replaceCount = Math.floor(Math.random() * 3) + 1;
            for (let i = 0; i < replaceCount; i++) {
                const randomIndex = Math.floor(Math.random() * gameState.globalRecruitPool.length);
                gameState.globalRecruitPool[randomIndex] = generateRandomEmployee();
            }
            
            io.emit('recruitPoolUpdate', gameState.globalRecruitPool);
            console.log('👥 招募池已更新');
        }
    } catch (error) {
        console.error('❌ Recruit pool update error:', error);
    }
}, 120000); // 每2分钟

// 定期触发世界事件
setInterval(() => {
    try {
        if (gameState.worldEvents.length < 2 && Math.random() < 0.2) {
            triggerWorldEvent();
        }
        
        // 清理过期事件
        const now = Date.now();
        gameState.worldEvents = gameState.worldEvents.filter(event => event.endTime > now);
    } catch (error) {
        console.error('❌ World event trigger error:', error);
    }
}, 180000); // 每3分钟检查

// 定期发送系统消息
setInterval(() => {
    try {
        if (Math.random() < 0.3) {
            const systemMessages = [
                '🏪 商业区传来繁忙的交易声',
                '🧙‍♂️ 法师塔的魔法光芒闪烁不定',
                '⚔️ 冒险者公会又有新的委托发布',
                '📚 大图书馆发现了古老的魔法典籍',
                '🐲 有探险队在郊外发现了龙的踪迹',
                '💰 交易所的金币价格出现异常波动',
                '🌟 夜空中出现了前所未见的星象',
                '🏰 都市议会正在讨论新的冒险法规',
                '⚡ 魔法传送网络出现了神秘信号',
                '🔮 占卜师预言将有重大事件发生',
                '🗡️ 传说中的神器再次现世',
                '🌲 魔法森林深处传来了奇怪的歌声'
            ];
            
            const message = systemMessages[Math.floor(Math.random() * systemMessages.length)];
            addChatMessage('都市快讯', message);
        }
    } catch (error) {
        console.error('❌ System message error:', error);
    }
}, 45000); // 每45秒

// 定期广播在线人数
setInterval(() => {
    io.emit('onlineCount', getOnlineCount());
}, 30000); // 每30秒

const PORT = process.env.PORT || 3000;

// 初始化
initializeRecruitPool();

server.listen(PORT, (error) => {
    if (error) {
        console.error('❌ 服务器启动失败:', error);
        process.exit(1);
    } else {
        console.log(`🚀 都市奇幻公司服务器 v2.0 运行在端口 ${PORT}`);
        console.log(`🌐 访问地址: http://localhost:${PORT}`);
        console.log(`✨ 奇幻都市等待CEO们的到来...`);
        console.log(`🆕 新功能: 采集系统、地牢探险、技能系统、装备系统`);
        
        // 启动消息
        addChatMessage('系统', '🌟 都市奇幻商业网络 v2.0 已启动！');
        addChatMessage('系统', '🆕 新功能上线：采集资源、地牢探险、员工技能、装备系统！');
        addChatMessage('系统', '✨ 欢迎各位CEO体验全新的奇幻冒险！');
    }
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('📥 收到 SIGTERM 信号，正在关闭服务器...');
    addChatMessage('系统', '🛑 服务器即将重启，请稍候...');
    server.close(() => {
        console.log('✅ 服务器已关闭');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('📥 收到 SIGINT 信号，正在关闭服务器...');
    addChatMessage('系统', '🛑 服务器即将关闭，请稍候...');
    server.close(() => {
        console.log('✅ 服务器已关闭');
        process.exit(0);
    });
});
