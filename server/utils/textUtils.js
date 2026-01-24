function removeThinkingContent(text) {
    return text ? text.replace(/<think>[\s\S]*?<\/think>/g, '').trim() : '';
}

module.exports = { removeThinkingContent };
