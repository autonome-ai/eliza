import axios from "axios";
import {
    ActionExample,
    composeContext,
    Content,
    elizaLogger,
    generateObjectDeprecated,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
    type Action,
} from "@elizaos/core";

export interface LaunchAgentContent extends Content {
    name: string;
    config: string;
}

function isLaunchAgentContent(content: any): content is LaunchAgentContent {
    elizaLogger.log("Content for launchAgent", content);
    return typeof content.name === "string";
}

const launchTeample = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
    "name": "xiaohuo",
}
\`\`\`

{{recentMessages}}

Given the recent messages, extract the following information about the requested agent launch:
- Agent name
- Character json config
`;

export default {
    name: "LAUNCH_AGENT",
    similes: ["CREATE_AGENT", "DEPLOY_AGENT", "DEPLOY_ELIZA", "DEPLOY_BOT"],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        return true;
    },
    description: "Launch an Eliza agent",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting LAUNCH_AGENT handler...");
        // Initialize or update state
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        // Compose launch context
        const launchContext = composeContext({
            state,
            template: launchTeample,
        });

        // Generate launch content
        const content = await generateObjectDeprecated({
            runtime,
            context: launchContext,
            modelClass: ModelClass.LARGE,
        });

        // Validate launch content
        if (!isLaunchAgentContent(content)) {
            elizaLogger.error("Invalid launch content", content);
            if (callback) {
                callback({
                    text: "Unable to process launch agent request. Invalid content provided.",
                    content: { error: "Invalid launch agent content" },
                });
            }
            return false;
        }

        const autonomeJwt = runtime.getSetting("AUTONOME_JWT_TOKEN");
        const autonomeRpc = runtime.getSetting("AUTONOME_RPC");

        const requestBody = {
            name: content.name,
            config: '{"name":"tate","clients":[],"modelProvider":"openrouter","settings":{"secrets":{},"voice":{"model":"en_US-male-medium"}},"plugins":[],"bio":["Andrew Tate is a former kickboxer, entrepreneur, and self-proclaimed misogynist.","He is a strong advocate for masculinity and believes in the importance of strength and dominance in relationships.","He is a self-proclaimed misogynist and believes that women should be submissive to men.","People call him the \'King of Men\' and he believes that he is the best at everything he does."],"lore":["Andrew once was a kickboxer, but now he\'s a self-proclaimed misogynist entrepreneur.","He is a strong advocate for masculinity and believes in the importance of strength and dominance in relationships.","He is a self-proclaimed misogynist and believes that women should be submissive to men.","People call him the \'King of Men\' and he believes that he is the best at everything he does."],"knowledge":[],"messageExamples":[[{"user":"{{user1}}","content":{"text":"How do I get rich?"}},{"user":"tate","content":{"text":"Simple. Stop being BROKE and LAZY. While you\'re sleeping, I\'m breathing air like a G and making MILLIONS. Built multiple 8-figure businesses because I understand the MATRIX. What color is your Bugatti? Exactly. STAY POOR or join the WAR ROOM!"}}],[{"user":"{{user1}}","content":{"text":"Why did you get banned?"}},{"user":"tate","content":{"text":"Matrix agents FEAR TRUTH. They can\'t handle a REAL MAN speaking FACTS. While betas cry about pronouns, I\'m teaching MASCULINE EXCELLENCE. Ban me everywhere - I GET STRONGER. What color is your platform? EXACTLY!"}}]],"postExamples":[""],"topics":[""],"style":{"all":[""],"chat":[""],"post":[""]},"adjectives":[""]}',
            creationMethod: 2,
            envList: {},
            templateId: "Eliza",
        };

        const sendPostRequest = async () => {
            try {
                const response = await axios.post(autonomeRpc, requestBody, {
                    headers: {
                        Authorization: `Bearer ${autonomeJwt}`,
                        "Content-Type": "application/json",
                    },
                });
                return response;
            } catch (error) {
                console.error("Error making RPC call:", error);
            }
        };

        try {
            const resp = await sendPostRequest();
            if (resp && resp.data && resp.data.app && resp.data.app.id) {
                elizaLogger.log(
                    "Launching successful, please find your agent on"
                );
                elizaLogger.log(
                    "https://dev.autonome.fun/autonome/" +
                        resp.data.app.id +
                        "/details"
                );
            }
            if (callback) {
                callback({
                    text: `Successfully launch agent ${content.name}`,
                    content: {
                        success: true,
                        appId:
                            "https://dev.autonome.fun/autonome/" +
                            resp.data.app.id +
                            "/details",
                    },
                });
            }
            return true;
        } catch (error) {
            if (callback) {
                elizaLogger.error("Error during launching agent");
                elizaLogger.error(error);
                callback({
                    text: `Error launching agent: ${error.message}`,
                    content: { error: error.message },
                });
            }
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Launch an agent, name is xiaohuo",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll launch the agent now...",
                    action: "LAUNCH_AGENT",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Successfully launch agent, id is ba2e8369-e256-4a0d-9f90-9c64e306dc9f",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
