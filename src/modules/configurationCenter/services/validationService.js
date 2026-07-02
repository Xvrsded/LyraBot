class ValidationService {
    validate(category, key, value) {
        // Bounds checking
        if (category === 'leveling' && key === 'xpPerActivity') {
            if (value < 0) throw new Error('XP cannot be negative');
        }
        if (category === 'economy' && key === 'transferTax') {
            if (value < 0 || value > 100) throw new Error('Tax must be between 0 and 100%');
        }
        if (category === 'inventory' && key === 'maxSlots') {
            if (value < 10) throw new Error('Inventory must have at least 10 slots');
        }
        
        return true;
    }
}

module.exports = new ValidationService();
