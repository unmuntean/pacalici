// Game Rules System
const gameRules = {
  // Available rules
  availableRules: [
    {
      id: 'nextPlayerOnly',
      name: 'Trage doar de la următorul jucător',
      description: 'Când pachetul e gol, poți trage cărți doar de la următorul jucător activ.',
      default: false
    }
    // More rules can be added here in the future
  ],
  
  // Active rules for the current game
  activeRules: {},
  
  // Initialize rules with defaults
  init() {
    this.activeRules = {};
    this.availableRules.forEach(rule => {
      this.activeRules[rule.id] = rule.default;
    });
    return this;
  },
  
  // Set a rule status
  setRule(ruleId, enabled) {
    if (ruleId in this.activeRules) {
      this.activeRules[ruleId] = enabled;
      console.log(`[Rules] Rule '${ruleId}' set to ${enabled}`);
      return true;
    }
    console.warn(`[Rules] Unknown rule: ${ruleId}`);
    return false;
  },
  
  // Check if a rule is enabled
  isEnabled(ruleId) {
    return this.activeRules[ruleId] === true;
  },
  
  // Get all active rules as an object
  getAllRules() {
    return {...this.activeRules};
  },
  
  // Render rules UI in the provided container
  renderRulesUI(container) {
    if (!container) return;
    
    container.innerHTML = '';
    
    const heading = document.createElement('h3');
    heading.className = 'font-semibold mb-2 text-gray-300';
    heading.textContent = 'Reguli opționale:';
    container.appendChild(heading);
    
    this.availableRules.forEach(rule => {
      const ruleContainer = document.createElement('div');
      ruleContainer.className = 'flex items-center space-x-2 mb-2';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `rule-${rule.id}`;
      checkbox.className = 'rounded text-indigo-600 focus:ring-indigo-500 border-gray-600 bg-gray-700';
      checkbox.checked = this.activeRules[rule.id];
      
      checkbox.addEventListener('change', (e) => {
        this.setRule(rule.id, e.target.checked);
      });
      
      const label = document.createElement('label');
      label.htmlFor = `rule-${rule.id}`;
      label.className = 'text-sm text-gray-300 flex flex-col';
      
      const ruleName = document.createElement('span');
      ruleName.textContent = rule.name;
      ruleName.className = 'font-medium';
      
      const ruleDescription = document.createElement('span');
      ruleDescription.textContent = rule.description;
      ruleDescription.className = 'text-xs text-gray-400';
      
      label.appendChild(ruleName);
      label.appendChild(ruleDescription);
      
      ruleContainer.appendChild(checkbox);
      ruleContainer.appendChild(label);
      container.appendChild(ruleContainer);
    });
  }
};

// Initialize rules
gameRules.init();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = gameRules;
} 