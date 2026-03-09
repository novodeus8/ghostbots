import { findByProps } from "@vendetta/metro";
import { before } from "@vendetta/patcher";

const BOTS_TO_HIDE = new Set([
    "276060004262477825", // Invite Tracker
    "563434444321587202", // Maki
    "356831787445387285", // GiselleBot
    "720351927581278219", // Koya
    "204255221017214977", // Agent Smith
    "155149108183695360", // Aether
    "282859044593598464", // ProBot (Previously labeled Daisy)
    "125367104336691200", // Flick
    "330416853971107840", // Xana
    // "330416853971107840" // <--- Add Welcomer's ID here!
]);

const FluxDispatcher = findByProps("dispatch", "isDispatching");
let unpatch: () => void;

export default {
    onLoad() {
        unpatch = before("dispatch", FluxDispatcher, (args) => {
            const event = args[0];
            if (!event) return args;
            
            try {
                // 1. Drop specific singular events safely
                if (event.type === "MESSAGE_CREATE" || event.type === "MESSAGE_UPDATE") {
                    if (BOTS_TO_HIDE.has(event.message?.author?.id)) {
                        args[0] = { type: "NOOP" };
                        return args;
                    }
                }
                if (event.type === "TYPING_START" && BOTS_TO_HIDE.has(event.userId)) {
                    args[0] = { type: "NOOP" };
                    return args;
                }
                if (event.type === "PRESENCE_UPDATE" && BOTS_TO_HIDE.has(event.user?.id)) {
                    args[0] = { type: "NOOP" };
                    return args;
                }

                // 2. Clone and filter any event containing a batch of messages (Chat, Search, etc.)
                if (Array.isArray(event.messages)) {
                    const filteredMessages = event.messages.map((group: any) => {
                        // Mobile search results are usually arrays inside of arrays
                        if (Array.isArray(group)) {
                            return group.filter((msg: any) => !BOTS_TO_HIDE.has(msg?.author?.id));
                        }
                        return group;
                    }).filter((group: any) => {
                        // Drop the group entirely if it's empty or if it's a flat message from a bot
                        if (Array.isArray(group)) return group.length > 0;
                        return !BOTS_TO_HIDE.has(group?.author?.id);
                    });

                    // Assign a cloned object to bypass strict mode / frozen object errors
                    args[0] = { ...event, messages: filteredMessages };
                }

                // 3. Clone and filter Member List safely
                if (event.type === "GUILD_MEMBER_LIST_UPDATE" && Array.isArray(event.ops)) {
                    const newOps = event.ops.map((op: any) => {
                        if (op.op === "SYNC" && Array.isArray(op.items)) {
                            let activeGroup: any = null;
                            const newItems = op.items.filter((item: any) => {
                                if (item.group) {
                                    activeGroup = item.group;
                                    return true;
                                }
                                const userId = item.member?.user?.id;
                                if (userId && BOTS_TO_HIDE.has(userId)) {
                                    if (activeGroup && activeGroup.count > 0) activeGroup.count--;
                                    return false; 
                                }
                                return true;
                            });
                            return { ...op, items: newItems };
                        }
                        return op;
                    });
                    
                    args[0] = { ...event, ops: newOps };
                }

            } catch (err) {
                console.error("GhostBots Error:", err);
            }
            return args; 
        });
    },
    
    onUnload() {
        if (unpatch) unpatch();
    }
};
