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
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 游戏状态
const gameState = {
    companies: new Map(),
    aiCompanies: [
        {
            id: 'ai_apple',
            name: '咬一口科技',
            value: 25800000,
            trend: 1,
            sector: '科技',
            companyType: 'tech',
            volatility: 0.08,
            underAttack: false,
            evilQuote: '隐私？那是什么？我们只是在"改善用户体验"',
            attackCooldowns: {}
        },
        {
            id: 'ai_microsoft',
            name: '巨硬垄断集团',
            value: 24200000,
            trend: 0,
            sector: '软件',
            companyType: 'tech',
            volatility: 0.06,
            underAttack: false,
            evilQuote: '拥抱、扩展、消灭 - 我们的永恒战略',
            attackCooldowns: {}
        },
        {
            id: 'ai_google',
            name: '狗狗搜索引擎',
            value: 23600000,
            trend: -1,
            sector: '互联网',
            companyType: 'tech',
            volatility: 0.09,
            underAttack: false,
            evilQuote: '"不作恶"？那个口号早就删了',
            attackCooldowns: {}
        },
        {
            id: 'ai_amazon',
            name: '压马逊剥削物流',
            value: 22800000,
            trend: 1,
            sector: '电商',
            companyType: 'retail',
            volatility: 0.07,
            underAttack: false,
            evilQuote: '员工的眼泪是最好的润滑剂',
            attackCooldowns: {}
        },
        {
            id: 'ai_tesla',
            name: '特死啦忽悠汽车',
            value: 18200000,
            trend: 1,
            sector: '汽车',
            companyType: 'manufacturing',
            volatility: 0.15,
            underAttack: false,
            evilQuote: '自动驾驶：让机器承担撞死人的责任',
            attackCooldowns: {}
        },
        {
            id: 'ai_goldman',
            name: '高盛吸血银行',
            value: 16600000,
            trend: 0,
            sector: '金融',
            companyType: 'finance',
            volatility: 0.05,
            underAttack: false,
            evilQuote: '经济危机？那是我们的发财机会！',
            attackCooldowns: {}
        }
    ],
    globalMarket: {
        workforce: { price: 15000, trend: 0, volume: 0, supply: 100, demand: 80 },
        materials: { price: 12000, trend: 1, volume: 0, supply: 120, demand: 150 },
        technology: { price: 35000, trend: -1, volume: 0, supply: 80, demand: 60 },
        energy: { price: 18000, trend: 0, volume: 0, supply: 200, demand: 180 },
        data: { price: 25000, trend: 1, volume: 0, supply: 90, demand: 140 },
        reputation: { price: 30000, trend: 0, volume: 0, supply: 60, demand: 70 },
        influence: { price: 75000, trend: 1, volume: 0, supply: 40, demand: 55 }
    },
    marketContracts: [],
    alliances: [],
    globalEvent: null,
    chatMessages: [],
    newsEvents: [],
    serverStartTime: Date.now(),
    attackCooldowns: new Map() // 玩家攻击冷却
};

// 联盟系统
class Alliance {
    constructor(id, name, creator) {
        this.id = id;
        this.name = name;
        this.creator = creator;
        this.members = [creator];
        this.createdAt = Date.now();
        this.totalValue = 0;
        this.contracts = [];
    }

    addMember(companyName) {
        if (!this.members.includes(companyName)) {
            this.members.push(companyName);
            return true;
        }
        return false;
    }

    removeMember(companyName) {
        const index = this.members.indexOf(companyName);
        if (index > -1) {
            this.members.splice(index, 1);
            return true;
        }
        return false;
    }

    updateTotalValue(companies) {
        this.totalValue = this.members.reduce((total, memberName) => {
            const company = Array.from(companies.values()).find(c => c.name === memberName);
            return total + (company ? calculateCompanyValue(company.gameData) : 0);
        }, 0);
    }
}

// 攻击系统配置
const attackTypes = {
    spy: {
        name: '商业间谍',
        cost: { money: 200000, influence: 8 },
        cooldown: 180000, // 3分钟
        description: '派遣间谍窃取技术和数据',
        execute: (attacker, target) => {
            const stolen = {
                technology: Math.floor(Math.random() * 20 + 10),
                data: Math.floor(Math.random() * 30 + 15)
            };
            
            // 窃取资源
            Object.keys(stolen).forEach(resource => {
                const amount = Math.min(stolen[resource], target.gameData.resources[resource] || 0);
                attacker.gameData.resources[resource] += amount;
                target.gameData.resources[resource] = Math.max(0, (target.gameData.resources[resource] || 0) - amount);
            });
            
            // 增加腐败指数
            attacker.gameData.corruptionIndex = Math.min(100, (attacker.gameData.corruptionIndex || 0) + 2);
            
            return {
                success: true,
                message: `${attacker.name} 成功窃取了 ${target.name} 的技术和数据！`,
                details: `获得 ${stolen.technology} 技术和 ${stolen.data} 数据`
            };
        }
    },
    legal: {
        name: '法律战',
        cost: { money: 500000, reputation: 15 },
        cooldown: 300000, // 5分钟
        description: '起诉专利侵权，冻结对方资产',
        execute: (attacker, target) => {
            const damage = Math.floor(target.gameData.resources.money * 0.1); // 冻结10%资金
            target.gameData.resources.money = Math.max(0, target.gameData.resources.money - damage);
            
            // 声誉受损
            target.gameData.resources.reputation = Math.max(0, (target.gameData.resources.reputation || 0) - 20);
            
            // 攻击者获得部分赔偿
            attacker.gameData.resources.money += Math.floor(damage * 0.3);
            attacker.gameData.resources.influence += 5;
            
            return {
                success: true,
                message: `${attacker.name} 起诉 ${target.name} 专利侵权成功！`,
                details: `冻结对方 ${Math.floor(damage)} 资金，获得 ${Math.floor(damage * 0.3)} 赔偿`
            };
        }
    },
    media: {
        name: '媒体战',
        cost: { money: 300000, influence: 12 },
        cooldown: 240000, // 4分钟
        description: '抹黑对方，影响其声誉和股价',
        execute: (attacker, target) => {
            // 声誉大幅下降
            target.gameData.resources.reputation = Math.max(0, (target.gameData.resources.reputation || 0) - 30);
            
            // 影响力下降
            target.gameData.resources.influence = Math.max(0, (target.gameData.resources.influence || 0) - 10);
            
            // 攻击者操控指数增加
            attacker.gameData.manipulationIndex = Math.min(100, (attacker.gameData.manipulationIndex || 0) + 3);
            
            // 如果目标是AI公司，影响其股价
            const aiTarget = gameState.aiCompanies.find(ai => ai.id === target.id);
            if (aiTarget) {
                aiTarget.value *= 0.9; // 股价下跌10%
                aiTarget.underAttack = true;
                setTimeout(() => {
                    aiTarget.underAttack = false;
                }, 60000);
            }
            
            return {
                success: true,
                message: `${attacker.name} 发动媒体战成功抹黑 ${target.name}！`,
                details: `对方声誉和影响力大幅下降`
            };
        }
    },
    poach: {
        name: '挖墙脚',
        cost: { money: 400000, reputation: 10 },
        cooldown: 200000, // 约3.3分钟
        description: '高薪挖走核心员工',
        execute: (attacker, target) => {
            const poached = Math.floor(Math.random() * 15 + 10); // 挖走10-25个员工
            const actualPoached = Math.min(poached, target.gameData.resources.workforce || 0);
            
            // 转移人力
            attacker.gameData.resources.workforce += actualPoached;
            target.gameData.resources.workforce = Math.max(0, (target.gameData.resources.workforce || 0) - actualPoached);
            
            // 目标生产力受损（部门效率临时降低）
            target.gameData.resources.technology = Math.max(0, (target.gameData.resources.technology || 0) - 10);
            
            // 攻击者剥削指数增加
            attacker.gameData.exploitationIndex = Math.min(100, (attacker.gameData.exploitationIndex || 0) + 1.5);
            
            return {
                success: true,
                message: `${attacker.name} 成功挖走 ${target.name} 的 ${actualPoached} 名核心员工！`,
                details: `获得 ${actualPoached} 人力资源`
            };
        }
    }
};

// 内幕信息生成器
const insiderInfoTemplates = [
    "即将发布重大产品，股价可能暴涨",
    "内部财务造假被发现，股价面临崩盘风险", 
    "正在秘密收购竞争对手",
    "高管即将大量抛售股票",
    "环境污染丑闻即将曝光",
    "获得政府秘密合同，利润将大增",
    "核心技术被窃取，竞争优势丧失",
    "员工大规模罢工，生产陷入停滞",
    "避税方案被税务部门调查",
    "即将进入新兴市场，前景广阔"
];

// 全球事件配置（增强版）
const globalEvents = [
    {
        id: 'economic_crisis',
        name: '经济危机',
        description: '全球经济衰退，所有公司市值下降10-30%',
        duration: 300000,
        effects: {
            allCompanies: { valueMultiplier: 0.8 },
            market: { workforce: { priceMultiplier: 0.7 }, materials: { priceMultiplier: 0.6 } }
        }
    },
    {
        id: 'tech_boom',
        name: '科技泡沫',
        description: '科技股暴涨，科技公司市值提升50%，科技资源需求大增',
        duration: 240000,
        effects: {
            techCompanies: { valueMultiplier: 1.5 },
            market: { technology: { priceMultiplier: 2, demandMultiplier: 3 }, data: { priceMultiplier: 1.8 } }
        }
    },
    {
        id: 'privacy_scandal',
        name: '隐私门丑闻',
        description: '大型科技公司数据泄露，监管加强，声誉系统重要性提升',
        duration: 360000,
        effects: {
            techCompanies: { reputationPenalty: 30 },
            market: { reputation: { priceMultiplier: 2.5 }, influence: { priceMultiplier: 1.8 } }
        }
    },
    {
        id: 'climate_crisis',
        name: '气候危机',
        description: '环保法规严厉，制造业受重创，清洁能源需求暴增',
        duration: 420000,
        effects: {
            manufacturingCompanies: { valueMultiplier: 0.7, pollutionPenalty: 50 },
            market: { energy: { priceMultiplier: 3, demandMultiplier: 4 } }
        }
    },
    {
        id: 'worker_uprising',
        name: '工人大起义',
        description: '全球工人罢工抗议996，人力成本飙升，剥削难度增加',
        duration: 300000,
        effects: {
            allCompanies: { exploitationPenalty: 20 },
            market: { workforce: { priceMultiplier: 2.5, demandMultiplier: 2 } }
        }
    },
    {
        id: 'ai_takeover',
        name: 'AI大替代',
        description: 'AI技术突破，人力需求锐减，数据价值飙升',
        duration: 480000,
        effects: {
            market: {
                data: { priceMultiplier: 5, demandMultiplier: 6 },
                technology: { priceMultiplier: 3 },
                workforce: { priceMultiplier: 0.3, demandMultiplier: 0.2 }
            }
        }
    }
];

console.log('🏢 黑心公司大亨服务器启动中...');

// 错误处理
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// 玩家连接处理
io.on('connection', (socket) => {
    console.log('🔗 新CEO连接:', socket.id);
    
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
                companyType: companyType || 'tech',
                gameData: gameData || createNewCompany(companyType),
                online: true,
                lastSeen: Date.now(),
                socket: socket
            };
