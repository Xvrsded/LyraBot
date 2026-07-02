const { 
    CreateRoleAction, 
    CreateCategoryAction, 
    CreateChannelAction, 
    DeleteRoleAction, 
    DeleteChannelAction, 
    UpdatePermissionsAction, 
    ConfigureDatabaseAction 
} = require('./setupActions');
const logger = require('../utils/logger');

class SetupPlanner {
    /**
     * Generates a step-by-step Execution Plan for the guild based on template configurations.
     * @param {Guild} guild Discord Guild object
     * @param {object} template Fully compiled template object
     * @param {string} strategy Conflict strategy ('Skip', 'Replace', 'Merge')
     * @returns {{ plan: SetupAction[], context: object }} Planned action list and initial context
     */
    generatePlan(guild, template, strategy = 'Skip') {
        logger.info(`[SetupPlanner] Planning setup for guild ${guild.name} with strategy: ${strategy}`);
        
        const plan = [];
        const context = {
            roles: {},       // roleName -> roleId
            categories: {},  // catName -> catId
            channels: {},    // chanName -> chanId
            rollback: {
                roles: [],
                channels: []
            }
        };

        // Cache existing guild objects for fast lookup
        const existingRoles = guild.roles.cache;
        const existingChannels = guild.channels.cache;

        // 1. Plan Roles
        if (template.roles) {
            template.roles.forEach(roleDef => {
                const existing = existingRoles.find(r => r.name === roleDef.name && !r.managed);
                if (existing) {
                    if (strategy === 'Replace') {
                        plan.push(new DeleteRoleAction(existing.id, roleDef.name));
                        plan.push(new CreateRoleAction(roleDef));
                    } else {
                        // Skip / Merge: reuse existing role
                        context.roles[roleDef.name] = existing.id;
                        logger.debug(`[SetupPlanner] Plan: Reuse existing role "${roleDef.name}"`);
                    }
                } else {
                    plan.push(new CreateRoleAction(roleDef));
                }
            });
        }

        // 2. Plan Categories
        if (template.categories) {
            template.categories.forEach(catDef => {
                const existing = existingChannels.find(c => c.type === 4 && c.name === catDef.name);
                if (existing) {
                    if (strategy === 'Replace') {
                        plan.push(new DeleteChannelAction(existing.id, catDef.name));
                        plan.push(new CreateCategoryAction(catDef));
                    } else {
                        // Skip / Merge: reuse
                        context.categories[catDef.name] = existing.id;
                        logger.debug(`[SetupPlanner] Plan: Reuse existing category "${catDef.name}"`);
                    }
                } else {
                    plan.push(new CreateCategoryAction(catDef));
                }
            });
        }

        // 3. Plan Channels
        if (template.channels) {
            template.channels.forEach(chanDef => {
                // Find if channel exists with matching name and matching category parent name
                const parentCatId = chanDef.parent ? context.categories[chanDef.parent] : null;
                const existing = existingChannels.find(c => {
                    const matchName = c.name === chanDef.name;
                    const matchType = c.type === (chanDef.type || 0);
                    const matchParent = parentCatId ? c.parentId === parentCatId : !c.parentId;
                    return matchName && matchType && matchParent;
                });

                if (existing) {
                    if (strategy === 'Replace') {
                        plan.push(new DeleteChannelAction(existing.id, chanDef.name));
                        plan.push(new CreateChannelAction(chanDef));
                    } else {
                        // Skip / Merge: reuse
                        context.channels[chanDef.name] = existing.id;
                        logger.debug(`[SetupPlanner] Plan: Reuse existing channel "${chanDef.name}"`);
                    }
                } else {
                    plan.push(new CreateChannelAction(chanDef));
                }
            });
        }

        // 4. Plan Permissions updates (for all defined template channels and categories)
        if (template.categories) {
            template.categories.forEach(catDef => {
                if (catDef.isStaffOnly) {
                    plan.push(new UpdatePermissionsAction(catDef.name, 'category', { isStaffOnly: true }));
                }
            });
        }

        if (template.channels) {
            template.channels.forEach(chanDef => {
                const hasOverrides = chanDef.isReadonly || chanDef.isLogs || chanDef.isStaffChat;
                if (hasOverrides) {
                    plan.push(new UpdatePermissionsAction(chanDef.name, 'channel', {
                        isReadonly: !!chanDef.isReadonly,
                        isLogs: !!chanDef.isLogs,
                        isStaffChat: !!chanDef.isStaffChat
                    }));
                }
            });
        }

        // 5. Plan database integration configuration
        if (template.welcome || template.logs) {
            plan.push(new ConfigureDatabaseAction(template.name, template.welcome, template.logs));
        }

        logger.info(`[SetupPlanner] Generated setup plan consisting of ${plan.length} actions.`);
        return { plan, context };
    }
}

module.exports = new SetupPlanner();
