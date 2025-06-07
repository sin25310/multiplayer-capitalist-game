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

app.get('/stats', (req, res) => {
    try {
        const stats = getOnlineStats();
        const topCompanies = getLeaderboard().slice(0, 5).map(c => ({
            name: c.name,
            value: c.value,
            isPlayer: c.isPlayer,
            online: c.online
        }));
        
        res.json({
            players: stats,
            topCompanies: topCompanies,
            serverUptime: Date.now() - gameState.serverStartTime,
            activeContracts: gameState.marketContracts.filter(c => !c.fulfilled).length,
            alliances: gameState.alliances.length,
            globalEvent: gameState.globalEvent ? gameState.globalEvent.name : null
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// 游戏状态
const gameState = {
    companies: new Map(),
    playerNames: new Map(),
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
    attackCooldowns: new Map()
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
        cooldown: 180000,
        description: '派遣间谍窃取技术和数据',
        execute: (attacker, target) => {
            const stolen = {
                technology: Math.floor(Math.random() * 20 + 10),
                data: Math.floor(Math.random() * 30 + 15)
            };
            
            Object.keys(stolen).forEach(resource => {
                const amount = Math.min(stolen[resource], target.gameData.resources[resource] || 0);
                attacker.gameData.resources[resource] += amount;
                target.gameData.resources[resource] = Math.max(0, (target.gameData.resources[resource] || 0) - amount);
            });
            
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
        cooldown: 300000,
        description: '起诉专利侵权，冻结对方资产',
        execute: (attacker, target) => {
            const damage = Math.floor(target.gameData.resources.money * 0.1);
            target.gameData.resources.money = Math.max(0, target.gameData.resources.money - damage);
            
            target.gameData.resources.reputation = Math.max(0, (target.gameData.resources.reputation || 0) - 20);
            
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
        cooldown: 240000,
        description: '抹黑对方，影响其声誉和股价',
        execute: (attacker, target) => {
            target.gameData.resources.reputation = Math.max(0, (target.gameData.resources.reputation || 0) - 30);
            target.gameData.resources.influence = Math.max(0, (target.gameData.resources.influence || 0) - 10);
            
            const aiTarget = gameState.aiCompanies.find(ai => ai.id === target.id);
            if (aiTarget) {
                aiTarget.value *= 0.9;
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
        cooldown: 200000,
        description: '高薪挖走核心员工',
        execute: (attacker, target) => {
            const poached = Math.floor(Math.random() * 15 + 10);
            const actualPoached = Math.min(poached, target.gameData.resources.workforce || 0);
            
            attacker.gameData.resources.workforce += actualPoached;
            target.gameData.resources.workforce = Math.max(0, (target.gameData.resources.workforce || 0) - actualPoached);
            
            target.gameData.resources.technology = Math.max(0, (target.gameData.resources.technology || 0) - 10);
            
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

// 全球事件配置
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
            manufacturingCompanies: { valueMultiplier: 0.7 },
            market: { energy: { priceMultiplier: 3, demandMultiplier: 4 } }
        }
    },
    {
        id: 'worker_uprising',
        name: '工人大起义',
        description: '全球工人罢工抗议996，人力成本飙升',
        duration: 300000,
        effects: {
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
            
            // 检查同名公司
            const existingPlayerWithSameName = Array.from(gameState.companies.values())
                .find(company => company.name === companyName && company.online);
            
            if (existingPlayerWithSameName) {
                socket.emit('nameConflict', { 
                    message: `公司名称 "${companyName}" 已被在线玩家使用，请选择其他名称`,
                    suggestion: companyName + '_' + Math.floor(Math.random() * 1000)
                });
                return;
            }
            
            // 查找是否有同名的离线玩家（继承存档）
            let inheritedData = null;
            let oldPlayerId = null;
            
            const offlinePlayerWithSameName = Array.from(gameState.companies.values())
                .find(company => company.name === companyName && !company.online);
            
            if (offlinePlayerWithSameName) {
                console.log(`🔄 发现同名离线玩家，准备继承存档: ${companyName}`);
                inheritedData = offlinePlayerWithSameName.gameData;
                oldPlayerId = offlinePlayerWithSameName.id;
                
                // 从旧的映射中移除
                gameState.companies.delete(oldPlayerId);
                if (gameState.playerNames.has(companyName)) {
                    gameState.playerNames.delete(companyName);
                }
                
                // 通知客户端成功继承存档
                socket.emit('inheritanceSuccess', {
                    message: `成功继承 "${companyName}" 的存档数据`,
                    inheritedValue: calculateCompanyValue(inheritedData),
                    lastSeen: offlinePlayerWithSameName.lastSeen
                });
            }
            
            const companyData = {
                id: socket.id,
                name: companyName,
                playerName: playerName,
                companyType: companyType || 'tech',
                gameData: inheritedData || gameData || createNewCompany(companyType),
                online: true,
                lastSeen: Date.now(),
                socket: socket,
                inheritedFrom: oldPlayerId
            };
            
            // 确保新的数据结构存在
            if (!companyData.gameData.shortPositions) companyData.gameData.shortPositions = {};
            if (!companyData.gameData.options) companyData.gameData.options = {};
            
            gameState.companies.set(socket.id, companyData);
            gameState.playerNames.set(companyName, socket.id);
            
            socket.emit('gameState', {
                globalMarket: gameState.globalMarket,
                marketContracts: gameState.marketContracts,
                leaderboard: getLeaderboard(),
                chatMessages: gameState.chatMessages.slice(-50),
                globalEvent: gameState.globalEvent,
                alliances: gameState.alliances.map(alliance => ({
                    id: alliance.id,
                    name: alliance.name,
                    creator: alliance.creator,
                    members: alliance.members,
                    totalValue: alliance.totalValue
                }))
            });
            
            socket.broadcast.emit('companyJoined', {
                id: socket.id,
                name: companyName
            });
            
            if (inheritedData) {
                addChatMessage('系统', `${companyName} 重新回到了商业战场！继承了之前的商业帝国！`);
                addNewsEvent(`🔄 ${companyName} 王者归来，继承庞大商业帝国重新参战`);
            } else {
                addChatMessage('系统', `${companyName} 进入了商业战场！又来一个黑心企业！`);
                addNewsEvent(`🏢 ${companyName} 正式开业，准备加入剥削大军`);
            }
            
            console.log(`🏢 公司 ${companyName}(${companyType}) ${inheritedData ? '继承存档' : '新建'}加入游戏`);
        } catch (error) {
            console.error('joinGame error:', error);
            socket.emit('error', { message: '加入游戏失败' });
        }
    });
    
    socket.on('updateGameData', (gameData) => {
        try {
            const company = gameState.companies.get(socket.id);
            if (company && gameData) {
                company.gameData = gameData;
                company.lastSeen = Date.now();
            }
        } catch (error) {
            console.error('updateGameData error:', error);
        }
    });
    
    socket.on('marketTrade', (data) => {
        try {
            const { action, resource, amount } = data;
            const company = gameState.companies.get(socket.id);
            
            if (!company || !gameState.globalMarket[resource]) {
                return;
            }
            
            const market = gameState.globalMarket[resource];
            const tradeAmount = Math.max(1, parseInt(amount) || 1);
            
            if (action === 'buy' && company.gameData.resources.money >= market.price * tradeAmount) {
                company.gameData.resources.money -= market.price * tradeAmount;
                company.gameData.resources[resource] = (company.gameData.resources[resource] || 0) + tradeAmount;
                
                market.demand += tradeAmount;
                market.volume += tradeAmount;
                market.price = Math.max(5000, market.price + Math.floor(tradeAmount * market.price * 0.01));
                
                socket.emit('tradeSuccess', { 
                    action, resource, amount: tradeAmount, 
                    message: `购买了${tradeAmount}单位${resource}`,
                    resourceData: company.gameData.resources
                });
                
                if (market.demand > market.supply * 1.5 && Math.random() < 0.3) {
                    const bonus = market.price * tradeAmount * 0.2;
                    company.gameData.resources.money += bonus;
                    addChatMessage('市场快讯', `${company.name} 在高需求市场中获得${Math.floor(bonus)}金币奖励！`);
                }
                
                io.emit('marketUpdate', gameState.globalMarket);
            }
            else if (action === 'sell' && (company.gameData.resources[resource] || 0) >= tradeAmount) {
                const sellPrice = Math.floor(market.price * 0.95);
                company.gameData.resources[resource] -= tradeAmount;
                company.gameData.resources.money += sellPrice * tradeAmount;
                
                market.supply += tradeAmount;
                market.volume += tradeAmount;
                market.price = Math.max(5000, market.price - Math.floor(tradeAmount * market.price * 0.005));
                
                socket.emit('tradeSuccess', { 
                    action, resource, amount: tradeAmount, 
                    message: `卖出了${tradeAmount}单位${resource}，获得${sellPrice * tradeAmount}金币`,
                    resourceData: company.gameData.resources
                });
                
                io.emit('marketUpdate', gameState.globalMarket);
            }
        } catch (error) {
            console.error('marketTrade error:', error);
        }
    });
    
    socket.on('stockTrade', (data) => {
        try {
            const { action, companyId, shares } = data;
            const player = gameState.companies.get(socket.id);
            
            if (!player) return;
            
            const targetCompany = [...gameState.companies.values(), ...gameState.aiCompanies]
                .find(c => c.id === companyId);
            
            if (!targetCompany) return;
            
            const sharePrice = Math.floor(targetCompany.value / 1000000) || 1;
            const tradeFee = player.gameData.companyType === 'finance' ? sharePrice * 0.01 : sharePrice * 0.02;
            const totalCost = sharePrice + tradeFee;
            const tradeShares = Math.max(1, parseInt(shares) || 1);
            
            if (!player.gameData.stocks) {
                player.gameData.stocks = {};
            }
            
            if (action === 'buy' && player.gameData.resources.money >= totalCost * tradeShares) {
                player.gameData.resources.money -= totalCost * tradeShares;
                player.gameData.stocks[companyId] = (player.gameData.stocks[companyId] || 0) + tradeShares;
                
                socket.emit('stockTradeSuccess', {
                    action, companyId, shares: tradeShares,
                    message: `购买了${tradeShares}股${targetCompany.name}股票`,
                    playerData: {
                        money: player.gameData.resources.money,
                        stocks: player.gameData.stocks
                    }
                });
            }
            else if (action === 'sell' && (player.gameData.stocks[companyId] || 0) >= tradeShares) {
                const sellPrice = sharePrice - tradeFee;
                player.gameData.stocks[companyId] -= tradeShares;
                player.gameData.resources.money += sellPrice * tradeShares;
                
                if (player.gameData.stocks[companyId] <= 0) {
                    delete player.gameData.stocks[companyId];
                }
                
                socket.emit('stockTradeSuccess', {
                    action, companyId, shares: tradeShares,
                    message: `卖出了${tradeShares}股${targetCompany.name}股票`,
                    playerData: {
                        money: player.gameData.resources.money,
                        stocks: player.gameData.stocks
                    }
                });
            }
        } catch (error) {
            console.error('stockTrade error:', error);
        }
    });

    // 做空交易
    socket.on('shortStock', (data) => {
        try {
            const { companyId, shares } = data;
            const player = gameState.companies.get(socket.id);
            
            if (!player) return;
            
            const targetCompany = [...gameState.companies.values(), ...gameState.aiCompanies]
                .find(c => c.id === companyId);
            
            if (!targetCompany) return;
            
            const sharePrice = Math.floor(targetCompany.value / 1000000) || 1;
            const margin = sharePrice * shares * 0.5;
            const tradeFee = sharePrice * shares * 0.03;
            
            if (!player.gameData.shortPositions) {
                player.gameData.shortPositions = {};
            }
            
            if (player.gameData.resources.money >= margin + tradeFee) {
                player.gameData.resources.money -= margin + tradeFee;
                player.gameData.shortPositions[companyId] = {
                    shares: (player.gameData.shortPositions[companyId]?.shares || 0) + shares,
                    entryPrice: sharePrice,
                    timestamp: Date.now()
                };
                
                socket.emit('stockTradeSuccess', {
                    action: 'short', companyId, shares,
                    message: `做空了${shares}股${targetCompany.name}股票`,
                    playerData: {
                        money: player.gameData.resources.money,
                        shortPositions: player.gameData.shortPositions
                    }
                });
                
                addChatMessage('市场快讯', `${player.name} 做空 ${targetCompany.name}，看跌后市！`);
            }
        } catch (error) {
            console.error('shortStock error:', error);
        }
    });

    // 期权交易
    socket.on('buyOption', (data) => {
        try {
            const { companyId, optionType, shares } = data;
            const player = gameState.companies.get(socket.id);
            
            if (!player) return;
            
            const targetCompany = [...gameState.companies.values(), ...gameState.aiCompanies]
                .find(c => c.id === companyId);
            
            if (!targetCompany) return;
            
            const sharePrice = Math.floor(targetCompany.value / 1000000) || 1;
            const optionPrice = sharePrice * 0.1 * shares;
            const leverage = 10;
            
            if (!player.gameData.options) {
                player.gameData.options = {};
            }
            
            if (player.gameData.resources.money >= optionPrice) {
                player.gameData.resources.money -= optionPrice;
                
                const optionKey = `${companyId}_${optionType}`;
                if (!player.gameData.options[optionKey]) {
                    player.gameData.options[optionKey] = [];
                }
                
                player.gameData.options[optionKey].push({
                    shares: shares,
                    strikePrice: sharePrice,
                    optionType: optionType,
                    leverage: leverage,
                    expiry: Date.now() + 600000,
                    premium: optionPrice
                });
                
                socket.emit('stockTradeSuccess', {
                    action: 'option', companyId, shares,
                    message: `购买了${shares}股${targetCompany.name}的${optionType}期权`,
                    playerData: {
                        money: player.gameData.resources.money,
                        options: player.gameData.options
                    }
                });
                
                addChatMessage('市场快讯', `${player.name} 购买 ${targetCompany.name} 期权，${optionType === 'call' ? '看涨' : '看跌'}后市！`);
            }
        } catch (error) {
            console.error('buyOption error:', error);
        }
    });

    // 内幕交易
    socket.on('getInsiderInfo', (data) => {
        try {
            const { companyId } = data;
            const player = gameState.companies.get(socket.id);
            
            if (!player) return;
            
            const cost = 100000;
            
            if (player.gameData.resources.money >= cost) {
                player.gameData.resources.money -= cost;
                
                const targetCompany = [...gameState.companies.values(), ...gameState.aiCompanies]
                    .find(c => c.id === companyId);
                
                if (targetCompany) {
                    const info = insiderInfoTemplates[Math.floor(Math.random() * insiderInfoTemplates.length)];
                    socket.emit('insiderInfo', {
                        companyId: companyId,
                        companyName: targetCompany.name,
                        info: info
                    });
                    
                    addChatMessage('市场快讯', `有人购买了 ${targetCompany.name} 的内幕信息`);
                }
            }
        } catch (error) {
            console.error('getInsiderInfo error:', error);
        }
    });

    // 商业攻击系统
    socket.on('executeAttack', (data) => {
        try {
            const { targetId, attackType } = data;
            const attacker = gameState.companies.get(socket.id);
            
            if (!attacker || !attackTypes[attackType]) {
                return;
            }
            
            const cooldownKey = `${socket.id}_${attackType}`;
            const lastAttack = gameState.attackCooldowns.get(cooldownKey);
            if (lastAttack && Date.now() - lastAttack < attackTypes[attackType].cooldown) {
                socket.emit('error', { message: '攻击冷却中，请稍后再试' });
                return;
            }
            
            const attack = attackTypes[attackType];
            if (!canAfford(attacker.gameData.resources, attack.cost)) {
                socket.emit('error', { message: '资源不足，无法发动攻击' });
                return;
            }
            
            let target = gameState.companies.get(targetId);
            if (!target) {
                target = gameState.aiCompanies.find(ai => ai.id === targetId);
            }
            
            if (!target) {
                socket.emit('error', { message: '目标不存在' });
                return;
            }
            
            payCost(attacker.gameData.resources, attack.cost);
            
            const result = attack.execute(attacker, target);
            
            gameState.attackCooldowns.set(cooldownKey, Date.now());
            
            socket.emit('attackResult', {
                attackType: attackType,
                targetId: targetId,
                success: result.success,
                message: result.message,
                details: result.details,
                resourceChanges: attacker.gameData.resources
            });
            
            if (target.socket) {
                target.socket.emit('underAttack', {
                    attackerName: attacker.name,
                    attackType: attackType,
                    message: `您被 ${attacker.name} 发动了${attack.name}攻击！`,
                    resourceChanges: target.gameData.resources
                });
            }
            
            addChatMessage('商业战报', result.message);
            addNewsEvent(`⚔️ ${result.message}`);
            
            console.log(`⚔️ ${attacker.name} 对 ${target.name} 发动了 ${attackType} 攻击`);
        } catch (error) {
            console.error('executeAttack error:', error);
        }
    });

    // 联盟系统
    socket.on('createAlliance', (data) => {
        try {
            const { name } = data;
            const creator = gameState.companies.get(socket.id);
            
            if (!creator || !name || name.trim().length === 0) {
                socket.emit('error', { message: '联盟名称不能为空' });
                return;
            }
            
            const existingAlliance = gameState.alliances.find(alliance => 
                alliance.members.includes(creator.name));
            
            if (existingAlliance) {
                socket.emit('error', { message: '您已经在其他联盟中' });
                return;
            }
            
            const allianceId = 'alliance_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const alliance = new Alliance(allianceId, name.trim(), creator.name);
            
            gameState.alliances.push(alliance);
            
            socket.emit('allianceCreated', {
                alliance: {
                    id: alliance.id,
                    name: alliance.name,
                    creator: alliance.creator,
                    members: alliance.members,
                    totalValue: alliance.totalValue
                }
            });
            
            io.emit('allianceUpdate', gameState.alliances.map(alliance => ({
                id: alliance.id,
                name: alliance.name,
                creator: alliance.creator,
                members: alliance.members,
                totalValue: alliance.totalValue
            })));
            
            addChatMessage('联盟快讯', `${creator.name} 创建了商业联盟 "${name}"`);
            addNewsEvent(`🤝 ${creator.name} 创建商业联盟 "${name}"，开始抱团作恶`);
            
        } catch (error) {
            console.error('createAlliance error:', error);
        }
    });

    socket.on('joinAlliance', (data) => {
        try {
            const { allianceId } = data;
            const player = gameState.companies.get(socket.id);
            
            if (!player) return;
            
            const alliance = gameState.alliances.find(a => a.id === allianceId);
            if (!alliance) {
                socket.emit('error', { message: '联盟不存在' });
                return;
            }
            
            if (alliance.members.includes(player.name)) {
                socket.emit('error', { message: '您已经在该联盟中' });
                return;
            }
            
            const existingAlliance = gameState.alliances.find(a => 
                a.members.includes(player.name));
            
            if (existingAlliance) {
                socket.emit('error', { message: '您已经在其他联盟中' });
                return;
            }
            
            alliance.addMember(player.name);
            alliance.updateTotalValue(gameState.companies);
            
            socket.emit('allianceJoined', {
                alliance: {
                    id: alliance.id,
                    name: alliance.name,
                    creator: alliance.creator,
                    members: alliance.members,
                    totalValue: alliance.totalValue
                }
            });
            
            io.emit('allianceUpdate', gameState.alliances.map(alliance => ({
                id: alliance.id,
                name: alliance.name,
                creator: alliance.creator,
                members: alliance.members,
                totalValue: alliance.totalValue
            })));
            
            addChatMessage('联盟快讯', `${player.name} 加入了联盟 "${alliance.name}"`);
            
        } catch (error) {
            console.error('joinAlliance error:', error);
        }
    });

    // IPO系统
    socket.on('initiateIPO', (data) => {
        try {
            const player = gameState.companies.get(socket.id);
            
            if (!player) return;
            
            if (player.gameData.isPublicCompany) {
                socket.emit('error', { message: '公司已经上市' });
                return;
            }
            
            const value = calculateCompanyValue(player.gameData);
            const requirements = {
                marketValue: value >= 50000000,
                departments: Object.values(player.gameData.departments).reduce((sum, dept) => sum + dept.count, 0) >= 10,
                reputation: player.gameData.resources.reputation >= 80,
                influence: player.gameData.resources.influence >= 30
            };
            
            const allMet = Object.values(requirements).every(req => req);
            
            if (!allMet) {
                socket.emit('error', { message: 'IPO条件不满足' });
                return;
            }
            
            player.gameData.isPublicCompany = true;
            player.gameData.resources.money += 100000000;
            player.gameData.resources.influence += 50;
            player.gameData.resources.reputation += 30;
            
            socket.emit('ipoSuccess', {
                message: '🎉 IPO成功！公司正式上市',
                funding: 100000000,
                resourceChanges: player.gameData.resources
            });
            
            addChatMessage('重大新闻', `🎉 ${player.name} IPO成功上市，融资1亿！`);
            addNewsEvent(`🎉 ${player.name} 成功IPO上市，从此走上割韭菜的康庄大道`);
            
            console.log(`🎉 ${player.name} IPO成功`);
            
        } catch (error) {
            console.error('initiateIPO error:', error);
        }
    });
    
    socket.on('executeStrategy', (data) => {
        try {
            const { strategyId, targetType } = data;
            const player = gameState.companies.get(socket.id);
            
            if (!player) return;
            
            const strategies = {
                market_manipulation: {
                    cost: { money: 500000, influence: 15 },
                    cooldown: 300,
                    execute: () => {
                        const bonus = player.gameData.resources.money * 0.2;
                        player.gameData.resources.money += bonus;
                        addChatMessage('市场快讯', `${player.name} 操控股价成功，市值暴涨20%！`);
                        return { 
                            message: '股价操控成功！市值提升20%',
                            resourceChanges: player.gameData.resources
                        };
                    }
                },
                industrial_espionage: {
                    cost: { money: 300000, influence: 10 },
                    cooldown: 240,
                    execute: () => {
                        const targets = [...gameState.companies.values(), ...gameState.aiCompanies]
                            .filter(c => c.id !== player.id);
                        if (targets.length === 0) return { message: '没有可窃取的目标' };
                        
                        const target = targets[Math.floor(Math.random() * targets.length)];
                        const stolen = {
                            technology: Math.floor(Math.random() * 30 + 10),
                            data: Math.floor(Math.random() * 20 + 5)
                        };
                        
                        player.gameData.resources.technology += stolen.technology;
                        player.gameData.resources.data += stolen.data;
                        
                        if (target.gameData) {
                            target.gameData.resources.technology = Math.max(0, (target.gameData.resources.technology || 0) - stolen.technology);
                            target.gameData.resources.data = Math.max(0, (target.gameData.resources.data || 0) - stolen.data);
                        }
                        
                        addChatMessage('市场快讯', `${player.name} 对${target.name}实施工业间谍活动！`);
                        return { 
                            message: `成功窃取${target.name}的技术和数据！`,
                            resourceChanges: player.gameData.resources
                        };
                    }
                },
                hostile_takeover: {
                    cost: { money: 2000000, influence: 50 },
                    cooldown: 600,
                    execute: () => {
                        const aiTargets = gameState.aiCompanies.filter(c => !c.underAttack);
                        if (aiTargets.length === 0) return { message: '没有可收购的目标' };
                        
                        const target = aiTargets.reduce((min, c) => c.value < min.value ? c : min);
                        const damage = target.value * 0.3;
                        target.value = Math.max(target.value * 0.7, 5000000);
                        target.underAttack = true;
                        
                        player.gameData.resources.money += damage * 0.1;
                        player.gameData.resources.influence += 20;
                        
                        addChatMessage('市场快讯', `${player.name} 对${target.name}发起恶意收购！${target.name}市值暴跌30%！`);
                        
                        setTimeout(() => {
                            target.underAttack = false;
                        }, 60000);
                        
                        return { 
                            message: `成功收购${target.name}部分资产！`,
                            resourceChanges: player.gameData.resources
                        };
                    }
                },
                media_campaign: {
                    cost: { money: 200000, reputation: 20 },
                    cooldown: 180,
                    execute: () => {
                        player.gameData.resources.reputation += 50;
                        player.gameData.resources.influence += 15;
                        
                        Object.keys(gameState.globalMarket).forEach(resource => {
                            gameState.globalMarket[resource].price *= (0.95 + Math.random() * 0.1);
                        });
                        
                        addChatMessage('市场快讯', `${player.name} 发起大规模媒体造势活动，声誉大涨！`);
                        return { 
                            message: '媒体造势成功！声誉和影响力大幅提升',
                            resourceChanges: player.gameData.resources
                        };
                    }
                },
                price_war: {
                    cost: { money: 800000, materials: 100 },
                    cooldown: 420,
                    execute: () => {
                        Object.keys(gameState.globalMarket).forEach(resource => {
                            gameState.globalMarket[resource].price *= 0.8;
                        });
                        
                        gameState.aiCompanies.forEach(company => {
                            company.value *= 0.9;
                        });
                        
                        addChatMessage('市场快讯', `${player.name} 发起价格战！整个市场价格暴跌！`);
                        return { 
                            message: '价格战发起成功！市场价格全面下跌',
                            resourceChanges: player.gameData.resources
                        };
                    }
                },
                regulatory_bribery: {
                    cost: { money: 1000000, influence: 30 },
                    cooldown: 480,
                    execute: () => {
                        player.gameData.resources.influence += 40;
                        
                        Object.keys(player.gameData.departments).forEach(deptKey => {
                            const dept = player.gameData.departments[deptKey];
                            Object.keys(dept.cost).forEach(resource => {
                                dept.cost[resource] = Math.floor(dept.cost[resource] * 0.8);
                            });
                        });
                        
                        addChatMessage('市场快讯', `${player.name} 贿赂监管机构成功，获得政策优势！`);
                        return { 
                            message: '监管贿赂成功！部门扩建成本永久降低20%',
                            resourceChanges: player.gameData.resources
                        };
                    }
                }
            };
            
            const strategy = strategies[strategyId];
            if (!strategy) return;
            
            const canAffordStrategy = Object.keys(strategy.cost).every(resource => 
                (player.gameData.resources[resource] || 0) >= strategy.cost[resource]);
            
            if (!canAffordStrategy) {
                socket.emit('error', { message: '资源不足，无法执行策略' });
                return;
            }
            
            Object.keys(strategy.cost).forEach(resource => {
                player.gameData.resources[resource] -= strategy.cost[resource];
            });
            
            const result = strategy.execute();
            
            socket.emit('strategyEffect', {
                strategyId: strategyId,
                cooldown: strategy.cooldown,
                message: result.message,
                resourceChanges: result.resourceChanges
            });
            
            console.log(`🎭 ${player.name} 执行了策略: ${strategyId}`);
        } catch (error) {
            console.error('executeStrategy error:', error);
        }
    });
    
    socket.on('fulfillContract', (data) => {
        try {
            const { contractId } = data;
            const player = gameState.companies.get(socket.id);
            
            if (!player) return;
            
            const contract = gameState.marketContracts.find(c => c.id === contractId);
            if (!contract || contract.fulfilled || Date.now() > contract.expiry) {
                return;
            }
            
            const canAffordContract = Object.keys(contract.required).every(resource => 
                (player.gameData.resources[resource] || 0) >= contract.required[resource]);
            
            if (!canAffordContract) {
                socket.emit('error', { message: '资源不足，无法完成合约' });
                return;
            }
            
            Object.keys(contract.required).forEach(resource => {
                player.gameData.resources[resource] -= contract.required[resource];
            });
            
            Object.keys(contract.reward).forEach(resource => {
                player.gameData.resources[resource] = (player.gameData.resources[resource] || 0) + contract.reward[resource];
            });
            
            contract.fulfilled = true;
            contract.fulfilledBy = player.name;
            
            addChatMessage('市场快讯', `${player.name} 完成了市场合约"${contract.name}"！`);
            
            socket.emit('tradeSuccess', {
                message: `成功完成合约"${contract.name}"！`,
                resourceData: player.gameData.resources
            });
            
            io.emit('contractsUpdate', gameState.marketContracts);
            
            console.log(`📋 ${player.name} 完成了合约: ${contract.name}`);
        } catch (error) {
            console.error('fulfillContract error:', error);
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
            console.error('chatMessage error:', error);
        }
    });
    
    socket.on('disconnect', () => {
        try {
            const company = gameState.companies.get(socket.id);
            if (company) {
                company.online = false;
                company.lastSeen = Date.now();
                
                socket.broadcast.emit('companyLeft', {
                    id: socket.id,
                    name: company.name
                });
                
                addChatMessage('系统', `${company.name} 暂时退出了商业战场，但帝国依然存在...`);
                addNewsEvent(`👋 ${company.name} 暂时离线，但商业帝国数据已保存`);
                console.log(`👋 公司 ${company.name} 断开连接，数据已保存`);
                
                // 7天后删除离线公司数据
                setTimeout(() => {
                    const offlineCompany = gameState.companies.get(socket.id);
                    if (offlineCompany && !offlineCompany.online) {
                        gameState.companies.delete(socket.id);
                        gameState.playerNames.delete(offlineCompany.name);
                        console.log(`🗑️ 清理7天未上线的公司数据: ${offlineCompany.name}`);
                    }
                }, 7 * 24 * 60 * 60 * 1000);
            }
        } catch (error) {
            console.error('disconnect error:', error);
        }
    });
    
    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });
});

function createNewCompany(companyType = 'tech') {
    try {
        const baseResources = {
            money: 1000000, 
            workforce: 20, 
            materials: 100, 
            technology: 50,
            energy: 80, 
            data: 30, 
            reputation: 100, 
            influence: 10
        };
        
        const typeBonus = {
            tech: { technology: 30, data: 20 },
            manufacturing: { materials: 80, energy: 50 },
            finance: { money: 500000, influence: 20 },
            retail: { reputation: 80, workforce: 30 }
        };
        
        const bonuses = typeBonus[companyType] || {};
        Object.keys(bonuses).forEach(resource => {
            if (baseResources[resource] !== undefined) {
                baseResources[resource] += bonuses[resource];
            }
        });
        
        return {
            resources: baseResources,
            departments: {
                hr: { name: 'HR部门', count: 1, cost: { money: 50000 }, level: 1 },
                manufacturing: { name: '生产部', count: 0, cost: { money: 80000, workforce: 5 }, level: 1 },
                rd: { name: '研发部', count: 0, cost: { money: 120000, workforce: 8 }, level: 1 },
                marketing: { name: '营销部', count: 0, cost: { money: 100000, workforce: 6 }, level: 1 },
                finance: { name: '金融部', count: 0, cost: { money: 150000, workforce: 10 }, level: 1 }
            },
            stocks: {},
            shortPositions: {},
            options: {},
            companyType: companyType,
            marketValue: 1000000,
            lastUpdate: Date.now(),
            isPublicCompany: false
        };
    } catch (error) {
        console.error('createNewCompany error:', error);
        return null;
    }
}

function getLeaderboard() {
    try {
        const companies = Array.from(gameState.companies.values())
            .filter(company => company && company.gameData)
            .map(company => {
                const value = calculateCompanyValue(company.gameData);
                return {
                    id: company.id,
                    name: company.name || '未知公司',
                    isPlayer: true,
                    value: value,
                    trend: Math.random() > 0.5 ? 1 : -1,
                    online: company.online,
                    companyType: company.companyType || 'tech',
                    underAttack: false
                };
            });
        
        const allCompanies = [...companies, ...gameState.aiCompanies.map(ai => ({
            ...ai,
            isPlayer: false,
            online: false
        }))];
        
        return allCompanies.sort((a, b) => (b.value || 0) - (a.value || 0));
    } catch (error) {
        console.error('getLeaderboard error:', error);
        return [];
    }
}

function calculateCompanyValue(gameData) {
    try {
        if (!gameData || !gameData.resources) {
            return 0;
        }
        
        let value = gameData.resources.money || 0;
        
        Object.keys(gameData.resources).forEach(resource => {
            if (resource !== 'money' && gameState.globalMarket[resource]) {
                value += (gameData.resources[resource] || 0) * gameState.globalMarket[resource].price;
            }
        });
        
        if (gameData.departments) {
            Object.keys(gameData.departments).forEach(key => {
                const dept = gameData.departments[key];
                if (dept && dept.count) {
                    const level = dept.level || 1;
                    value += dept.count * level * 100000;
                }
            });
        }
        
        if (gameData.stocks) {
            Object.keys(gameData.stocks).forEach(companyId => {
                const shares = gameData.stocks[companyId];
                const company = [...gameState.companies.values(), ...gameState.aiCompanies]
                    .find(c => c.id === companyId);
                if (company && shares > 0) {
                    const sharePrice = Math.floor(company.value / 1000000) || 1;
                    value += shares * sharePrice;
                }
            });
        }
        
        return Math.max(0, value);
    } catch (error) {
        console.error('calculateCompanyValue error:', error);
        return 0;
    }
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
    } catch (error) {
        console.error('addChatMessage error:', error);
    }
}

function addNewsEvent(message) {
    try {
        if (!message) return;
        
        const newsEvent = {
            message: String(message),
            timestamp: Date.now()
        };
        
        gameState.newsEvents.push(newsEvent);
        
        if (gameState.newsEvents.length > 50) {
            gameState.newsEvents.shift();
        }
        
        io.emit('newsUpdate', newsEvent);
    } catch (error) {
        console.error('addNewsEvent error:', error);
    }
}

function canAfford(resources, cost) {
    return Object.keys(cost).every(resource => 
        (resources[resource] || 0) >= cost[resource]);
}

function payCost(resources, cost) {
    Object.keys(cost).forEach(resource => {
        resources[resource] = (resources[resource] || 0) - cost[resource];
    });
}

function getOnlineStats() {
    const onlinePlayers = Array.from(gameState.companies.values()).filter(c => c.online);
    const offlinePlayers = Array.from(gameState.companies.values()).filter(c => !c.online);
    
    return {
        online: onlinePlayers.length,
        offline: offlinePlayers.length,
        total: gameState.companies.size
    };
}

function forceRename(oldName, newName) {
    const company = Array.from(gameState.companies.values())
        .find(c => c.name === oldName);
    
    if (company) {
        gameState.playerNames.delete(oldName);
        company.name = newName;
        gameState.playerNames.set(newName, company.id);
        
        if (company.socket) {
            company.socket.emit('forceRenamed', {
                oldName: oldName,
                newName: newName,
                message: `您的公司已被重命名为 "${newName}"`
            });
        }
        
        addChatMessage('系统', `${oldName} 已被重命名为 ${newName}`);
        return true;
    }
    return false;
}

function updateMarketSupplyDemand() {
    try {
        Object.keys(gameState.globalMarket).forEach(resource => {
            gameState.globalMarket[resource].supply = 50;
            gameState.globalMarket[resource].demand = 40;
        });
        
        gameState.companies.forEach(company => {
            if (company.gameData && company.gameData.departments) {
                Object.keys(company.gameData.departments).forEach(deptKey => {
                    const dept = company.gameData.departments[deptKey];
                    if (dept.count > 0) {
                        const level = dept.level || 1;
                        switch (deptKey) {
                            case 'hr':
                                gameState.globalMarket.workforce.supply += dept.count * level * 5;
                                break;
                            case 'manufacturing':
                                gameState.globalMarket.materials.supply += dept.count * level * 8;
                                gameState.globalMarket.energy.demand += dept.count * level * 3;
                                break;
                            case 'rd':
                                gameState.globalMarket.technology.supply += dept.count * level * 4;
                                gameState.globalMarket.data.supply += dept.count * level * 3;
                                break;
                            case 'marketing':
                                gameState.globalMarket.reputation.supply += dept.count * level * 5;
                                break;
                            case 'finance':
                                gameState.globalMarket.influence.supply += dept.count * level * 3;
                                break;
                        }
                    }
                });
            }
        });
        
        gameState.aiCompanies.forEach(company => {
            const baseSupply = Math.floor(company.value / 1000000);
            Object.keys(gameState.globalMarket).forEach(resource => {
                gameState.globalMarket[resource].supply += baseSupply / 10;
                gameState.globalMarket[resource].demand += baseSupply / 15;
            });
        });
    } catch (error) {
        console.error('updateMarketSupplyDemand error:', error);
    }
}

function generateMarketContract() {
    try {
        const contractTypes = [
            {
                name: '紧急材料订单',
                description: '工厂急需大批原材料',
                required: { materials: 200 },
                reward: { money: 500000, reputation: 10 }
            },
            {
                name: '科技研发项目',
                description: '政府委托的秘密研发项目',
                required: { technology: 80, data: 60 },
                reward: { money: 800000, influence: 15 }
            },
            {
                name: '能源供应合同',
                description: '城市电网需要紧急能源补给',
                required: { energy: 150 },
                reward: { money: 400000, reputation: 8 }
            },
            {
                name: '人才输送计划',
                description: '大型项目需要专业人才',
                required: { workforce: 50 },
                reward: { money: 300000, influence: 8 }
            },
            {
                name: '数据分析委托',
                description: '跨国公司的市场分析需求',
                required: { data: 100, technology: 40 },
                reward: { money: 600000, reputation: 12 }
            }
        ];
        
        const template = contractTypes[Math.floor(Math.random() * contractTypes.length)];
        
        const contract = {
            id: 'contract_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            name: template.name,
            description: template.description,
            required: { ...template.required },
            reward: { ...template.reward },
            expiry: Date.now() + (2 + Math.random() * 4) * 60 * 60 * 1000,
            fulfilled: false,
            fulfilledBy: null
        };
        
        Object.keys(contract.required).forEach(resource => {
            contract.required[resource] = Math.floor(contract.required[resource] * (0.7 + Math.random() * 0.6));
        });
        
        Object.keys(contract.reward).forEach(resource => {
            contract.reward[resource] = Math.floor(contract.reward[resource] * (0.8 + Math.random() * 0.4));
        });
        
        gameState.marketContracts.push(contract);
        
        addChatMessage('市场快讯', `新市场合约发布："${contract.name}"，限时完成！`);
        addNewsEvent(`📋 新合约发布："${contract.name}"，酬金丰厚但风险巨大`);
        io.emit('contractsUpdate', gameState.marketContracts);
        
        console.log(`📋 生成新合约: ${contract.name}`);
    } catch (error) {
        console.error('generateMarketContract error:', error);
    }
}

function triggerGlobalEvent() {
    try {
        if (gameState.globalEvent) return;
        
        const event = globalEvents[Math.floor(Math.random() * globalEvents.length)];
        
        gameState.globalEvent = {
            ...event,
            startTime: Date.now(),
            endTime: Date.now() + event.duration
        };
        
        addChatMessage('全球事件', `${event.name}: ${event.description}`);
        addNewsEvent(`🌍 全球事件爆发：${event.name} - ${event.description}`);
        io.emit('globalEvent', gameState.globalEvent);
        
        applyGlobalEventEffects(event);
        
        setTimeout(() => {
            gameState.globalEvent = null;
            addChatMessage('全球事件', `${event.name} 事件已结束`);
            addNewsEvent(`🌍 全球事件结束：${event.name} 的影响逐渐消散`);
            io.emit('globalEvent', null);
            
            restoreNormalState();
        }, event.duration);
        
        console.log(`🌍 触发全球事件: ${event.name}`);
    } catch (error) {
        console.error('triggerGlobalEvent error:', error);
    }
}

function applyGlobalEventEffects(event) {
    try {
        if (event.effects.allCompanies) {
            gameState.aiCompanies.forEach(company => {
                if (event.effects.allCompanies.valueMultiplier) {
                    company.value *= event.effects.allCompanies.valueMultiplier;
                }
            });
        }
        
        if (event.effects.techCompanies) {
            gameState.aiCompanies.forEach(company => {
                if (company.companyType === 'tech' && event.effects.techCompanies.valueMultiplier) {
                    company.value *= event.effects.techCompanies.valueMultiplier;
                }
            });
        }
        
        if (event.effects.manufacturingCompanies) {
            gameState.aiCompanies.forEach(company => {
                if (company.companyType === 'manufacturing' && event.effects.manufacturingCompanies.valueMultiplier) {
                    company.value *= event.effects.manufacturingCompanies.valueMultiplier;
                }
            });
        }
        
        if (event.effects.market) {
           Object.keys(event.effects.market).forEach(resource => {
                if (gameState.globalMarket[resource]) {
                    const marketEffect = event.effects.market[resource];
                    if (marketEffect.priceMultiplier) {
                        gameState.globalMarket[resource].price *= marketEffect.priceMultiplier;
                    }
                    if (marketEffect.demandMultiplier) {
                        gameState.globalMarket[resource].demand *= marketEffect.demandMultiplier;
                    }
                }
            });
        }
    } catch (error) {
        console.error('applyGlobalEventEffects error:', error);
    }
}

function restoreNormalState() {
    try {
        Object.keys(gameState.globalMarket).forEach(resource => {
            const market = gameState.globalMarket[resource];
            const basePrice = {
                workforce: 15000,
                materials: 12000,
                technology: 35000,
                energy: 18000,
                data: 25000,
                reputation: 30000,
                influence: 75000
            };
            
            if (market.price > basePrice[resource] * 3) {
                market.price = basePrice[resource] * 3;
            } else if (market.price < basePrice[resource] * 0.3) {
                market.price = basePrice[resource] * 0.3;
            }
        });
        
        console.log('🔄 全球状态已恢复正常');
    } catch (error) {
        console.error('restoreNormalState error:', error);
    }
}

function updateAllianceValues() {
    gameState.alliances.forEach(alliance => {
        alliance.updateTotalValue(gameState.companies);
    });
}

function processExpiredOptions() {
    gameState.companies.forEach(company => {
        if (company.gameData.options) {
            Object.keys(company.gameData.options).forEach(optionKey => {
                const options = company.gameData.options[optionKey];
                
                for (let i = options.length - 1; i >= 0; i--) {
                    const option = options[i];
                    if (Date.now() > option.expiry) {
                        const [companyId, optionType] = optionKey.split('_');
                        const targetCompany = [...gameState.companies.values(), ...gameState.aiCompanies]
                            .find(c => c.id === companyId);
                        
                        if (targetCompany) {
                            const currentPrice = Math.floor(targetCompany.value / 1000000) || 1;
                            let profit = 0;
                            
                            if (optionType === 'call' && currentPrice > option.strikePrice) {
                                profit = (currentPrice - option.strikePrice) * option.shares * option.leverage - option.premium;
                            } else if (optionType === 'put' && currentPrice < option.strikePrice) {
                                profit = (option.strikePrice - currentPrice) * option.shares * option.leverage - option.premium;
                            } else {
                                profit = -option.premium;
                            }
                            
                            company.gameData.resources.money += Math.max(0, profit);
                            
                            if (company.socket) {
                                company.socket.emit('optionExpired', {
                                    companyName: targetCompany.name,
                                    optionType: optionType,
                                    profit: profit,
                                    message: profit > 0 ? 
                                        `期权盈利 ${Math.floor(profit)} 💰` : 
                                        `期权亏损 ${Math.floor(Math.abs(profit))} 💰`
                                });
                            }
                        }
                        
                        options.splice(i, 1);
                    }
                }
                
                if (options.length === 0) {
                    delete company.gameData.options[optionKey];
                }
            });
        }
    });
}

// 清理长期离线玩家的定时任务
setInterval(() => {
    try {
        const now = Date.now();
        const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
        
        const toDelete = [];
        gameState.companies.forEach((company, id) => {
            if (!company.online && company.lastSeen < sevenDaysAgo) {
                toDelete.push({ id, name: company.name });
            }
        });
        
        toDelete.forEach(({ id, name }) => {
            gameState.companies.delete(id);
            gameState.playerNames.delete(name);
            console.log(`🗑️ 自动清理长期离线玩家: ${name}`);
        });
        
        if (toDelete.length > 0) {
            addChatMessage('系统', `清理了${toDelete.length}个长期离线的公司数据`);
        }
    } catch (error) {
        console.error('Cleanup error:', error);
    }
}, 60 * 60 * 1000);

// 定期更新市场价格
setInterval(() => {
    try {
        updateMarketSupplyDemand();
        
        Object.keys(gameState.globalMarket).forEach(resource => {
            const market = gameState.globalMarket[resource];
            if (market) {
                const supplyDemandRatio = (market.demand + 1) / (market.supply + 1);
                let supplyDemandAdjustment = (supplyDemandRatio - 1) * 0.1;
                
                supplyDemandAdjustment = Math.max(-0.15, Math.min(0.15, supplyDemandAdjustment));
                const randomChange = (Math.random() - 0.5) * 0.05;
                
                const totalChange = supplyDemandAdjustment + randomChange;
                market.price = Math.max(5000, Math.floor(market.price * (1 + totalChange)));
                market.trend = totalChange > 0.02 ? 1 : totalChange < -0.02 ? -1 : 0;
                
                market.volume = Math.floor((market.volume || 0) * 0.9);
            }
        });
        
        // 更新AI公司价值
        gameState.aiCompanies.forEach(company => {
            if (company) {
                const baseVolatility = company.volatility || 0.08;
                const globalEventMultiplier = gameState.globalEvent ? 1.5 : 1;
                const volatility = baseVolatility * globalEventMultiplier;
                
                let change = (Math.random() - 0.5) * volatility;
                
                if (company.trend > 0) {
                    change += 0.01;
                } else if (company.trend < 0) {
                    change -= 0.01;
                }
                
                if (Math.random() < 0.1) {
                    company.trend = Math.random() > 0.5 ? 1 : -1;
                }
                
                if (company.underAttack) {
                    change -= 0.02;
                }
                
                const oldValue = company.value;
                company.value = Math.max(1000000, Math.floor(company.value * (1 + change)));
                
                const actualChange = (company.value - oldValue) / oldValue;
                company.trend = actualChange > 0.01 ? 1 : actualChange < -0.01 ? -1 : 0;
                
                if (Math.abs(actualChange) > 0.1) {
                    const direction = actualChange > 0 ? '暴涨' : '暴跌';
                    const percent = Math.abs(actualChange * 100).toFixed(1);
                    addChatMessage('市场快讯', `${company.name} 股价${direction}${percent}%！市场震荡！`);
                    addNewsEvent(`📈 ${company.name} 股价${direction}${percent}%，${direction === '暴涨' ? '投资者狂欢' : '股民血本无归'}`);
                }
            }
        });
        
        io.emit('marketUpdate', gameState.globalMarket);
    } catch (error) {
        console.error('Market update error:', error);
    }
}, 15000);

// 定期更新排行榜和联盟
setInterval(() => {
    try {
        updateAllianceValues();
        io.emit('leaderboardUpdate', getLeaderboard());
        io.emit('allianceUpdate', gameState.alliances.map(alliance => ({
            id: alliance.id,
            name: alliance.name,
            creator: alliance.creator,
            members: alliance.members,
            totalValue: alliance.totalValue
        })));
    } catch (error) {
        console.error('Leaderboard update error:', error);
    }
}, 8000);

// 定期处理期权到期
setInterval(() => {
    try {
        processExpiredOptions();
    } catch (error) {
        console.error('Options processing error:', error);
    }
}, 30000);

// 定期生成市场合约
setInterval(() => {
    try {
        gameState.marketContracts = gameState.marketContracts.filter(contract => 
            Date.now() <= contract.expiry || contract.fulfilled
        );
        
        if (gameState.marketContracts.filter(c => !c.fulfilled).length < 5 && Math.random() < 0.4) {
            generateMarketContract();
        }
    } catch (error) {
        console.error('Contract generation error:', error);
    }
}, 120000);

// 定期触发全球事件
setInterval(() => {
    try {
        if (!gameState.globalEvent && Math.random() < 0.15) {
            triggerGlobalEvent();
        }
    } catch (error) {
        console.error('Global event trigger error:', error);
    }
}, 300000);

// AI公司邪恶言论
setInterval(() => {
    try {
        if (Math.random() < 0.3) {
            const aiCompanies = gameState.aiCompanies.filter(c => c && c.name);
            if (aiCompanies.length > 0) {
                const aiCompany = aiCompanies[Math.floor(Math.random() * aiCompanies.length)];
                const evilQuotes = [
                    '又到了季度末，该"优化"人员结构了',
                    '用户数据？这是我们的核心资产！',
                    '垄断不是目标，是结果',
                    '什么？员工要涨薪？先让他们证明自己的价值',
                    '市场调节？我们就是市场！',
                    '慈善？那是给股东看的表演',
                    '创新的目的就是让竞争对手破产',
                    '法律？我们有最好的律师团队',
                    '环保？只要不被发现就行',
                    '消费者就是我们的ATM机'
                ];
                
                const quote = aiCompany.evilQuote || evilQuotes[Math.floor(Math.random() * evilQuotes.length)];
                addChatMessage(aiCompany.name, quote);
            }
        }
    } catch (error) {
        console.error('AI quote error:', error);
    }
}, 25000);

// AI公司之间的互动
setInterval(() => {
    try {
        if (Math.random() < 0.2) {
            const interactions = [
                '发起价格战',
                '签署合作协议',
                '相互指控不正当竞争',
                '展开专利大战',
                '进行秘密谈判',
                '公开批评对方商业模式',
                '联合垄断某个市场',
                '互相挖角核心员工'
            ];
            
            const companies = gameState.aiCompanies.filter(c => c.value > 5000000);
            if (companies.length >= 2) {
                const company1 = companies[Math.floor(Math.random() * companies.length)];
                let company2 = companies[Math.floor(Math.random() * companies.length)];
                
                while (company2.id === company1.id && companies.length > 1) {
                    company2 = companies[Math.floor(Math.random() * companies.length)];
                }
                
                const interaction = interactions[Math.floor(Math.random() * interactions.length)];
                
                switch (interaction) {
                    case '发起价格战':
                        company1.value *= 0.95;
                        company2.value *= 0.93;
                        break;
                    case '签署合作协议':
                        company1.value *= 1.05;
                        company2.value *= 1.03;
                        break;
                    case '展开专利大战':
                        company1.value *= 0.97;
                        company2.value *= 0.98;
                        break;
                    case '联合垄断某个市场':
                        company1.value *= 1.08;
                        company2.value *= 1.06;
                        const resource = Object.keys(gameState.globalMarket)[Math.floor(Math.random() * Object.keys(gameState.globalMarket).length)];
                        gameState.globalMarket[resource].price *= 1.2;
                        break;
                }
                
                addChatMessage('商业新闻', `${company1.name} 与 ${company2.name} ${interaction}！`);
                addNewsEvent(`🏢 ${company1.name} 与 ${company2.name} ${interaction}，商业格局再次变化`);
            }
        }
    } catch (error) {
        console.error('AI interaction error:', error);
    }
}, 180000);

const PORT = process.env.PORT || 3000;

server.listen(PORT, (error) => {
    if (error) {
        console.error('服务器启动失败:', error);
        process.exit(1);
    } else {
        console.log(`🚀 黑心公司大亨服务器运行在端口 ${PORT}`);
        console.log(`🌐 访问地址: http://localhost:${PORT}`);
        console.log(`💼 等待黑心CEO们的加入...`);
        
        setTimeout(() => {
            for (let i = 0; i < 3; i++) {
                generateMarketContract();
            }
        }, 5000);
    }
});

process.on('SIGTERM', () => {
    console.log('收到 SIGTERM 信号，正在关闭服务器...');
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('收到 SIGINT 信号，正在关闭服务器...');
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});
