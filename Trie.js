// Node for the Trie
class TrieNode {
    constructor() {
        this.children = new Map();
        this.isEndOfPrefix = false; // True if this node ends a blocked subnet
        this.version = null; // 4 for IPv4, 6 for IPv6
    }
}

// The Tree structure
class IPTrie {
    constructor() {
        this.root = new TrieNode();
    }

    // Detect IP version (4 or 6)
    _getIPVersion(address) {
        if (address.includes(':')) {
            return 6; // IPv6
        } else if (address.includes('.')) {
            return 4; // IPv4
        }
        return null;
    }

    // Split IP address into parts based on version
    _splitIP(address) {
        const version = this._getIPVersion(address);
        if (version === 4) {
            return address.split('.');
        } else if (version === 6) {
            return address.split(':');
        }
        return [];
    }

    // Get separator based on IP version
    _getSeparator(version) {
        return version === 6 ? ':' : '.';
    }

    // Insert an IP prefix (e.g., "192.168" for IPv4 or "2001:db8" for IPv6)
    insert(ipPrefix) {
        let current = this.root;
        const version = this._getIPVersion(ipPrefix);
        const parts = this._splitIP(ipPrefix);
        
        if (!parts.length) return;
        
        for (const part of parts) {
            if (!current.children.has(part)) {
                current.children.set(part, new TrieNode());
            }
            current = current.children.get(part);
        }
        current.isEndOfPrefix = true;
        current.version = version; // Store IP version for later reconstruction
    }

    // Search if an IP is blocked (supports both IPv4 and IPv6)
    search(ipAddress) {
        let current = this.root;
        const parts = this._splitIP(ipAddress);
        
        if (!parts.length) return false;
        
        for (const part of parts) {
            if (!current.children.has(part)) {
                return false; // Path doesn't exist
            }
            current = current.children.get(part);
            if (current.isEndOfPrefix) {
                return true; // Matches a blocked prefix
            }
        }
        return false;
    }

    // Get all blocked IP prefixes
    getAllBlocked() {
        const blocked = [];
        this._collectBlocked(this.root, [], blocked);
        return blocked;
    }

    // Helper method to collect blocked prefixes
    _collectBlocked(node, currentPath, blocked) {
        if (node.isEndOfPrefix) {
            const separator = this._getSeparator(node.version);
            blocked.push(currentPath.join(separator));
        }
        
        for (const [part, childNode] of node.children) {
            currentPath.push(part);
            this._collectBlocked(childNode, currentPath, blocked);
            currentPath.pop();
        }
    }

    // Remove a blocked IP prefix (supports both IPv4 and IPv6)
    remove(ipPrefix) {
        const parts = this._splitIP(ipPrefix);
        if (!parts.length) return false;
        return this._removeHelper(this.root, parts, 0);
    }

    // Helper method to remove a prefix
    _removeHelper(node, parts, index) {
        if (index === parts.length) {
            if (node.isEndOfPrefix) {
                node.isEndOfPrefix = false;
                return true;
            }
            return false;
        }

        const part = parts[index];
        if (!node.children.has(part)) {
            return false; // Path doesn't exist
        }

        const childNode = node.children.get(part);
        const removed = this._removeHelper(childNode, parts, index + 1);

        // Clean up empty nodes
        if (removed && childNode.children.size === 0 && !childNode.isEndOfPrefix) {
            node.children.delete(part);
        }

        return removed;
    }
}

module.exports = IPTrie;