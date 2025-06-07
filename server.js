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
            evilQuote: '隐私？那是什么？我们只是在"改善用户体验"'
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
            evilQuote: '拥抱、扩展、消灭 - 我们的永恒战略'
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
            evilQuote: '"不作恶"？那个口号早就删了'
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
            evilQuote: '员工的眼泪是最好的润滑剂'
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
            evilQuote: '自动驾驶：让机器承担撞死人的责任'
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
            evilQuote: '经济危机？那是我们的发财机会！'
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
    globalEvent: null,
    chatMessages: [],
    serverStartTime: Date.now()
};

// 全球事件配置
const globalEvents = [
    {
        id: 'economic_crisis',
        name: '经济危机',
        description: '全球经济衰退，所有公司市值下降10-30%',
        duration: 300000, // 5分钟
        effects: {
            allCompanies: { valueMultiplier: 0.8 },
            market: { workforce: { priceMultiplier: 0.7 }, materials: { priceMultiplier: 0.6 } }
        }
    },
    {
        id: 'tech_boom',
        name: '科技泡沫',
        description: '科技股暴涨，科技公司市值提升50%，科技资源需求大增',
        duration: 240000, // 4分钟
        effects: {
            techCompanies: { valueMultiplier: 1.5 },
            market: { technology: { priceMultiplier: 2, demandMultiplier: 3 }, data: { priceMultiplier: 1.8 } }
        }
    },
    {
        id: 'supply_chain_crisis',
        name: '供应链危机',
        description: '全球供应链中断，材料和能源价格飙升',
        duration: 360000, // 6分钟
        effects: {
            market: { 
                materials: { priceMultiplier: 3, demandMultiplier: 2 },
                energy: { priceMultiplier: 2.5, demandMultiplier: 2 }
            }
        }
    },
    {
        id: 'regulatory_crackdown',
        name: '监管风暴',
        description: '政府加强监管，所有公司影响力和声誉受损',
        duration: 300000, // 5分钟
        effects: {
            allCompanies: { reputationPenalty: 20, influencePenalty: 10 },
            market: { influence: { priceMultiplier: 1.5 } }
        }
    },
    {
        id: 'ai_revolution',
        name: 'AI革命',
        description: '人工智能技术突破，数据价值暴增，人力需求下降',
        duration: 420000, // 7分钟
        effects: {
            market: {
                data: { priceMultiplier: 4, demandMultiplier: 5 },
                technology: { priceMultiplier: 2 },
                workforce: { priceMultiplier: 0.5, demandMultiplier: 0.3 }
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
            
            gameState.companies.set(socket.id, companyData);
            
            socket.emit('gameState', {
                globalMarket: gameState.globalMarket,
                marketContracts: gameState.marketContracts,
                leaderboard: getLeaderboard(),
                chatMessages: gameState.chatMessages.slice(-50),
                globalEvent: gameState.globalEvent
            });
            
            socket.broadcast.emit('companyJoined', {
                id: socket.id,
                name: companyName
            });
            
            addChatMessage('系统', `${companyName} 进入了商业战场！又来一个黑心企业！`);
            console.log(`🏢 公司 ${companyName}(${companyType}) 加入游戏`);
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
                
                // 更新市场供需
                market.demand += tradeAmount;
                market.volume += tradeAmount;
                
                // 动态价格调整
                market.price = Math.max(5000, market.price + Math.floor(tradeAmount * market.price * 0.01));
                
                socket.emit('tradeSuccess', { 
                    action, resource, amount: tradeAmount, 
                    message: `购买了${tradeAmount}单位${resource}`,
                    resourceData: company.gameData.resources
                });
                
                // 检查是否满足高需求市场奖励
                if (market.demand > market.supply * 1.5 && Math.random() < 0.3) {
                    const bonus = market.price * tradeAmount * 0.2;
                    company.gameData.resources.money += bonus;
                    addChatMessage('市场快讯', `${company.name} 在高需求市场中获得${Math.floor(bonus)}金币奖励！`);
                }
                
                io.emit('marketUpdate', gameState.globalMarket);
                console.log(`💰 ${company.name} 购买了 ${tradeAmount} 个 ${resource}`);
            }
            else if (action === 'sell' && (company.gameData.resources[resource] || 0) >= tradeAmount) {
                const sellPrice = Math.floor(market.price * 0.95); // 卖价比买价低5%
                company.gameData.resources[resource] -= tradeAmount;
                company.gameData.resources.money += sellPrice * tradeAmount;
                
                // 更新市场供需
                market.supply += tradeAmount;
                market.volume += tradeAmount;
                
                // 动态价格调整
                market.price = Math.max(5000, market.price - Math.floor(tradeAmount * market.price * 0.005));
                
                socket.emit('tradeSuccess', { 
                    action, resource, amount: tradeAmount, 
                    message: `卖出了${tradeAmount}单位${resource}，获得${sellPrice * tradeAmount}金币`,
                    resourceData: company.gameData.resources
                });
                
                io.emit('marketUpdate', gameState.globalMarket);
                console.log(`💱 ${company.name} 卖出了 ${tradeAmount} 个 ${resource}`);
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
                
                console.log(`📈 ${player.name} 购买了 ${tradeShares} 股 ${targetCompany.name}`);
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
                
                console.log(`📉 ${player.name} 卖出了 ${tradeShares} 股 ${targetCompany.name}`);
            }
        } catch (error) {
            console.error('stockTrade error:', error);
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
                        // 随机选择一个目标公司
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
                        // 选择市值最低的AI公司进行收购
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
                        
                        // 影响市场价格
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
                        // 影响所有公司和市场价格
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
                        
                        // 降低所有部门成本
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
            
            // 检查是否能够支付成本
            const canAfford = Object.keys(strategy.cost).every(resource => 
                (player.gameData.resources[resource] || 0) >= strategy.cost[resource]);
            
            if (!canAfford) {
                socket.emit('error', { message: '资源不足，无法执行策略' });
                return;
            }
            
            // 支付成本
            Object.keys(strategy.cost).forEach(resource => {
                player.gameData.resources[resource] -= strategy.cost[resource];
            });
            
            // 执行策略
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
            
            // 检查是否能够支付成本
            const canAfford = Object.keys(contract.required).every(resource => 
                (player.gameData.resources[resource] || 0) >= contract.required[resource]);
            
            if (!canAfford) {
                socket.emit('error', { message: '资源不足，无法完成合约' });
                return;
            }
            
            // 支付成本
            Object.keys(contract.required).forEach(resource => {
                player.gameData.resources[resource] -= contract.required[resource];
            });
            
            // 获得奖励
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
                
                socket.broadcast.emit('companyLeft', {
                    id: socket.id,
                    name: company.name
                });
                
                addChatMessage('系统', `${company.name} 退出了商业战场`);
                console.log(`👋 公司 ${company.name} 断开连接`);
                
                // 24小时后删除公司数据
                setTimeout(() => {
                    gameState.companies.delete(socket.id);
                }, 24 * 60 * 60 * 1000);
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
        
        // 根据公司类型应用初始加成
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
                hr: { name: 'HR部门', count: 1, cost: { money: 50000 } },
                manufacturing: { name: '生产部', count: 0, cost: { money: 80000, workforce: 5 } },
                rd: { name: '研发部', count: 0, cost: { money: 120000, workforce: 8 } },
                marketing: { name: '营销部', count: 0, cost: { money: 100000, workforce: 6 } },
                finance: { name: '金融部', count: 0, cost: { money: 150000, workforce: 10 } }
            },
            stocks: {},
            companyType: companyType,
            marketValue: 1000000,
            lastUpdate: Date.now()
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
        
        // 添加AI公司
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
        
        // 资源价值
        Object.keys(gameData.resources).forEach(resource => {
            if (resource !== 'money' && gameState.globalMarket[resource]) {
                value += (gameData.resources[resource] || 0) * gameState.globalMarket[resource].price;
            }
        });
        
        // 部门价值
        if (gameData.departments) {
            Object.keys(gameData.departments).forEach(key => {
                const dept = gameData.departments[key];
                if (dept && dept.count) {
                    value += dept.count * 100000;
                }
            });
        }
        
        // 股票价值
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

function updateMarketSupplyDemand() {
    try {
        // 重置供需统计
        Object.keys(gameState.globalMarket).forEach(resource => {
            gameState.globalMarket[resource].supply = 50;
            gameState.globalMarket[resource].demand = 40;
        });
        
        // 统计所有玩家的供需
        gameState.companies.forEach(company => {
            if (company.gameData && company.gameData.departments) {
                Object.keys(company.gameData.departments).forEach(deptKey => {
                    const dept = company.gameData.departments[deptKey];
                    if (dept.count > 0) {
                        // 简化的供需计算
                        switch (deptKey) {
                            case 'hr':
                                gameState.globalMarket.workforce.supply += dept.count * 5;
                                gameState.globalMarket.money.demand += dept.count * 2;
                                break;
                            case 'manufacturing':
                                gameState.globalMarket.materials.supply += dept.count * 8;
                                gameState.globalMarket.energy.demand += dept.count * 3;
                                gameState.globalMarket.workforce.demand += dept.count * 2;
                                break;
                            case 'rd':
                                gameState.globalMarket.technology.supply += dept.count * 4;
                                gameState.globalMarket.data.supply += dept.count * 3;
                                gameState.globalMarket.workforce.demand += dept.count * 4;
                                break;
                            case 'marketing':
                                gameState.globalMarket.reputation.supply += dept.count * 5;
                                gameState.globalMarket.data.demand += dept.count * 2;
                                break;
                            case 'finance':
                                gameState.globalMarket.influence.supply += dept.count * 3;
                                gameState.globalMarket.data.demand += dept.count * 6;
                                break;
                        }
                    }
                });
            }
        });
        
        // AI公司的供需影响
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
            expiry: Date.now() + (2 + Math.random() * 4) * 60 * 60 * 1000, // 2-6小时
            fulfilled: false,
            fulfilledBy: null
        };
        
        // 随机调整需求和奖励
        Object.keys(contract.required).forEach(resource => {
            contract.required[resource] = Math.floor(contract.required[resource] * (0.7 + Math.random() * 0.6));
        });
        
        Object.keys(contract.reward).forEach(resource => {
            contract.reward[resource] = Math.floor(contract.reward[resource] * (0.8 + Math.random() * 0.4));
        });
        
        gameState.marketContracts.push(contract);
        
        addChatMessage('市场快讯', `新市场合约发布："${contract.name}"，限时完成！`);
        io.emit('contractsUpdate', gameState.marketContracts);
        
        console.log(`📋 生成新合约: ${contract.name}`);
    } catch (error) {
        console.error('generateMarketContract error:', error);
    }
}

function triggerGlobalEvent() {
    try {
        if (gameState.globalEvent) return; // 已有事件进行中
        
        const event = globalEvents[Math.floor(Math.random() * globalEvents.length)];
        
        gameState.globalEvent = {
            ...event,
            startTime: Date.now(),
            endTime: Date.now() + event.duration
        };
        
        addChatMessage('全球事件', `${event.name}: ${event.description}`);
        io.emit('globalEvent', gameState.globalEvent);
        
        // 应用事件效果
        applyGlobalEventEffects(event);
        
        // 设置事件结束定时器
        setTimeout(() => {
            gameState.globalEvent = null;
            addChatMessage('全球事件', `${event.name} 事件已结束`);
            io.emit('globalEvent', null);
            
            // 恢复正常状态
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
        
        // 应用对玩家公司的影响
        if (event.effects.allCompanies) {
            gameState.companies.forEach(company => {
                if (event.effects.allCompanies.reputationPenalty) {
                    company.gameData.resources.reputation = Math.max(0, 
                        (company.gameData.resources.reputation || 0) - event.effects.allCompanies.reputationPenalty);
                }
                if (event.effects.allCompanies.influencePenalty) {
                    company.gameData.resources.influence = Math.max(0, 
                        (company.gameData.resources.influence || 0) - event.effects.allCompanies.influencePenalty);
                }
            });
        }
    } catch (error) {
        console.error('applyGlobalEventEffects error:', error);
    }
}

function restoreNormalState() {
    try {
        // 这里可以添加恢复正常状态的逻辑
        // 比如重置市场价格到合理范围等
        Object.keys(gameState.globalMarket).forEach(resource => {
            const market = gameState.globalMarket[resource];
            // 将价格逐渐恢复到基础价格范围
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

// 定期更新市场价格
setInterval(() => {
    try {
        updateMarketSupplyDemand();
        
        Object.keys(gameState.globalMarket).forEach(resource => {
            const market = gameState.globalMarket[resource];
            if (market) {
                // 基于供需的价格调整
                const supplyDemandRatio = (market.demand + 1) / (market.supply + 1);
                let supplyDemandAdjustment = (supplyDemandRatio - 1) * 0.1;
                
                // 限制调整幅度
                supplyDemandAdjustment = Math.max(-0.15, Math.min(0.15, supplyDemandAdjustment));
                
                // 随机波动
                const randomChange = (Math.random() - 0.5) * 0.05;
                
                const totalChange = supplyDemandAdjustment + randomChange;
                market.price = Math.max(5000, Math.floor(market.price * (1 + totalChange)));
                market.trend = totalChange > 0.02 ? 1 : totalChange < -0.02 ? -1 : 0;
                
                // 重置交易量
                market.volume = Math.floor((market.volume || 0) * 0.9);
            }
        });
        
        // 更新AI公司价值 - 更加明显的波动
        gameState.aiCompanies.forEach(company => {
            if (company) {
                // 使用每个公司独特的波动率
                const baseVolatility = company.volatility || 0.08;
                const globalEventMultiplier = gameState.globalEvent ? 1.5 : 1;
                const volatility = baseVolatility * globalEventMultiplier;
                
                let change = (Math.random() - 0.5) * volatility;
                
                // 增加趋势性变化
                if (company.trend > 0) {
                    change += 0.01; // 上升趋势
                } else if (company.trend < 0) {
                    change -= 0.01; // 下降趋势
                }
                
                // 随机改变趋势
                if (Math.random() < 0.1) {
                    company.trend = Math.random() > 0.5 ? 1 : -1;
                }
                
                // 如果公司受到攻击，额外的负面影响
                if (company.underAttack) {
                    change -= 0.02;
                }
                
                const oldValue = company.value;
                company.value = Math.max(1000000, Math.floor(company.value * (1 + change)));
                
                // 更新趋势指示器
                const actualChange = (company.value - oldValue) / oldValue;
                company.trend = actualChange > 0.01 ? 1 : actualChange < -0.01 ? -1 : 0;
                
                // 极端变化时发送通知
                if (Math.abs(actualChange) > 0.1) {
                    const direction = actualChange > 0 ? '暴涨' : '暴跌';
                    const percent = Math.abs(actualChange * 100).toFixed(1);
                    addChatMessage('市场快讯', `${company.name} 股价${direction}${percent}%！市场震荡！`);
                }
            }
        });
        
        io.emit('marketUpdate', gameState.globalMarket);
        console.log('📈 市场价格和AI公司价值已更新');
    } catch (error) {
        console.error('Market update error:', error);
    }
}, 15000); // 每15秒更新一次

// 定期更新排行榜
setInterval(() => {
    try {
        io.emit('leaderboardUpdate', getLeaderboard());
    } catch (error) {
        console.error('Leaderboard update error:', error);
    }
}, 8000); // 每8秒更新一次

// 定期生成市场合约
setInterval(() => {
    try {
        // 清理过期合约
        gameState.marketContracts = gameState.marketContracts.filter(contract => 
            Date.now() <= contract.expiry || contract.fulfilled
        );
        
        // 生成新合约（如果合约数量少于5个）
        if (gameState.marketContracts.filter(c => !c.fulfilled).length < 5 && Math.random() < 0.4) {
            generateMarketContract();
        }
    } catch (error) {
        console.error('Contract generation error:', error);
    }
}, 120000); // 每2分钟检查一次

// 定期触发全球事件
setInterval(() => {
    try {
        if (!gameState.globalEvent && Math.random() < 0.15) { // 15%概率
            triggerGlobalEvent();
        }
    } catch (error) {
        console.error('Global event trigger error:', error);
    }
}, 300000); // 每5分钟检查一次

// 定期发送AI公司的"邪恶言论"
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
                    '消费者就是我们的ATM机',
                    '996是福报，007是梦想！',
                    '数据泄露？那叫共享经济',
                    '税收？避税才是艺术',
                    '竞争对手？收购他们就行了',
                    '监管？我们比监管机构更懂业务'
                ];
                
                const quote = aiCompany.evilQuote || evilQuotes[Math.floor(Math.random() * evilQuotes.length)];
                addChatMessage(aiCompany.name, quote);
            }
        }
    } catch (error) {
        console.error('AI quote error:', error);
    }
}, 25000); // 每25秒检查一次

// AI公司之间的互动
setInterval(() => {
    try {
        if (Math.random() < 0.2) { // 20%概率
            const interactions = [
                '发起价格战',
                '签署合作协议',
                '相互指控不正当竞争',
                '展开专利大战',
                '进行秘密谈判',
                '公开批评对方商业模式'
            ];
            
            const companies = gameState.aiCompanies.filter(c => c.value > 5000000);
            if (companies.length >= 2) {
                const company1 = companies[Math.floor(Math.random() * companies.length)];
                let company2 = companies[Math.floor(Math.random() * companies.length)];
                
                // 确保不是同一家公司
                while (company2.id === company1.id && companies.length > 1) {
                    company2 = companies[Math.floor(Math.random() * companies.length)];
                }
                
                const interaction = interactions[Math.floor(Math.random() * interactions.length)];
                
                // 根据互动类型影响股价
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
                }
                
                addChatMessage('商业新闻', `${company1.name} 与 ${company2.name} ${interaction}！`);
            }
        }
    } catch (error) {
        console.error('AI interaction error:', error);
    }
}, 180000); // 每3分钟检查一次

const PORT = process.env.PORT || 3000;

server.listen(PORT, (error) => {
    if (error) {
        console.error('服务器启动失败:', error);
        process.exit(1);
    } else {
        console.log(`🚀 黑心公司大亨服务器运行在端口 ${PORT}`);
        console.log(`🌐 访问地址: http://localhost:${PORT}`);
        console.log(`💼 等待黑心CEO们的加入...`);
        
        // 启动时生成一些初始合约
        setTimeout(() => {
            for (let i = 0; i < 3; i++) {
                generateMarketContract();
            }
        }, 5000);
    }
});

// 优雅关闭
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
