console = {};
console.log = function(message) {
    const entry = document.createElement('div');
    entry.textContent = message;
    document.getElementById('console').prepend(entry);
};

console.warn = console.log;
console.error = console.log;
console.info = console.log;

$(document).ready(function() {
    $('#reset-state-btn').click(function() {
        if (confirm("Are you sure you want to reset all saved state?")) {
            localStorage.removeItem('state');
            localStorage.removeItem('settings');
            location.reload();
        }
    });

    const game = new Game();

    $('#reset-btn').click(function() {
        if (confirm("Are you sure you want to reset the game? This will clear your progress.")) {
            game.newGame();
        }
    });
});

class Game {
    constructor() {
        this.$grid = $('#game-grid');
        this.loadSettings();
        this.loadState();
        this.bindButtonEvents();
        console.log("Game initialized");
    }

    loadSettings = function() {
        const DEFAULT_SETTINGS = {
            staticGridSize: false,
            gridSize: 7,
            staticDifficulty: false,
            difficulty: 5,
            showSums: true,
            showColorGroups: true,
            stdProbability: 0.25,
            sparseProbability: 0.75,
            currentStreak: 0,
            lastDateCompleted: null,
            streakFreezes: 3,
            currentLevel: 1,
        };
        const settings = JSON.parse(localStorage.getItem('settings') || '{}');

        this.settings = { ...DEFAULT_SETTINGS, ...settings };
        this.saveSettings();

        $('#show-current-sums').prop('checked', this.settings.showSums);
        $('#show-color-groups').prop('checked', this.settings.showColorGroups);
        $('body').toggleClass('disable-current-sums', !this.settings.showSums);
        $('#static-grid-size').prop('checked', this.settings.staticGridSize);
        $('#static-grid-size-slider').val(this.settings.gridSize);
        $('#static-grid-size-value').text(this.settings.gridSize);
        $('#static-grid-size-lbl').toggle(this.settings.staticGridSize);
        $('#static-difficulty').prop('checked', this.settings.staticDifficulty);
        $('#static-difficulty-slider').val(this.settings.difficulty);
        $('#static-difficulty-value').text(this.settings.difficulty);
        $('#static-difficulty-lbl').toggle(this.settings.staticDifficulty);

        $('#current-streak').text(this.settings.currentStreak);
        let freezes = "";
        for (let i = 0; i < this.settings.streakFreezes; i++) freezes += "❄️";
        $('#freezes').text(freezes);
    }

    saveSettings = function() {
        localStorage.setItem('settings', JSON.stringify(this.settings));
    }

    loadState = function() {
        this.state = JSON.parse(localStorage.getItem('state'));
        if (!this.state) {
            console.log("No game state found, starting a new game.");
            this.newGame();
        } else {
            console.log("Game state loaded from localStorage");
            this.renderGrid();
        }

        this.togglePencilMode(this.state.pencilMode);
        $('#seed-input').val(this.state.seed);
    }

    saveState = function() {
        localStorage.setItem('state', JSON.stringify(this.state));
    }

    getCurrentLevel = function() {
        if (!this.settings.currentLevel) {
            this.settings.currentLevel = 1;
        }
        return this.settings.currentLevel;
    }

    newGame = function(seed, isDaily) {
        if (isDaily === true) seed = new Date().toLocaleDateString('en-CA');

        this.loadSettings();
        this.state = {
            isDaily: isDaily === true,
            seed: seed || this.getCurrentLevel(),
            gridSize: parseInt(this.settings.gridSize),
            pencilMode: false,
            lives: 3,
            maxLives: 3,
        };
        const rand = new alea(this.state.seed);
        this.generateNumbers(rand);
        this.generateDecoyMap(rand);
        this.generateColorGroupMap(rand);
        this.generateSolveMap();
        this.generateSums(rand);
        this.saveState();

        this.togglePencilMode(this.state.pencilMode);
        this.renderGrid();
        this.updateLives();

        $('#seed-input').val(this.state.seed);
    }

    resetGame = function() {
        this.generateSolveMap();
        this.state.lives = this.state.maxLives;
        this.saveState();

        this.renderGrid();
        this.updateLives();
    }

    wonGame = function() {
        $('#win-popup').fadeIn(200);

        if (this.state.isDaily) {
            const today = new Date().toLocaleDateString('en-CA');
            this.settings.currentStreak += 1;
            this.settings.lastDateCompleted = today;
            this.saveSettings();
        } else if (this.state.seed == this.settings.currentLevel) {
            this.settings.currentLevel += 1;
            this.saveSettings();
        }

        this.showConfetti();
    }

    showConfetti = function() {
        const $canvas = $('canvas.confetti-canvas');

        const canvas = $canvas[0];
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const ctx = canvas.getContext('2d');

        // Confetti parameters
        const confettiCount = 120;
        const colors = ['#ffb300', '#ff5252', '#4fc3f7', '#81c784', '#ffd54f', '#f06292', '#fff176'];
        const confetti = [];

        for (let i = 0; i < confettiCount; i++) {
            confetti.push({
                x: Math.random() * canvas.width,
                y: Math.random() * -canvas.height,
                r: Math.random() * 6 + 14,
                d: Math.random() * confettiCount,
                color: colors[Math.floor(Math.random() * colors.length)],
                tilt: Math.random() * 10 - 10,
                tiltAngleIncremental: (Math.random() * 0.07) + .05,
                tiltAngle: 0
            });
        }

        let angle = 0;
        let tiltAngle = 0;
        let animationFrame;

        function drawConfetti() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            angle += 0.01;
            tiltAngle += 0.1;

            for (let i = 0; i < confetti.length; i++) {
                let c = confetti[i];
                c.tiltAngle += c.tiltAngleIncremental;
                c.y += (Math.cos(angle + c.d) + 3 + c.r / 2) / 2;
                c.tilt = Math.sin(c.tiltAngle - (i % 3)) * 15;

                ctx.beginPath();
                ctx.lineWidth = c.r;
                ctx.strokeStyle = c.color;
                ctx.moveTo(c.x + c.tilt + c.r / 3, c.y);
                ctx.lineTo(c.x + c.tilt, c.y + c.tilt + c.r / 5);
                ctx.stroke();
            }

            animationFrame = requestAnimationFrame(drawConfetti);
        }

        drawConfetti();

        setTimeout(() => {
            cancelAnimationFrame(animationFrame);
        }, 10000);
    }

    lostGame = function() {
        $('#lose-popup').fadeIn(200);
    }

    updateLives = function(value) {
        if (typeof value === "number") this.state.lives += value;

        const $lives = $('#lives');
        let livesText = "";
        for (let i = 0; i < this.state.lives; i++) livesText += "❤️";
        for (let i = this.state.lives; i < this.state.maxLives; i++) livesText += "🤍";
        $lives.html(livesText);
        console.info(`Lives: ${this.state.lives}`);

        if (this.state.lives <= 0) this.lostGame();
    }

    togglePencilMode = function(newMode) {
        if (typeof newMode === "boolean") {
            this.state.pencilMode = newMode;
        } else {
            this.state.pencilMode = !this.state.pencilMode;
        }
        $('body').toggleClass('pencilMode', this.state.pencilMode);
        this.saveState();
        console.info(`Mode: ${this.state.pencilMode ? 'Pencil' : 'Eraser'}`);
    }


    bindButtonEvents = function() {
        $('body').bind('click', (event) => {
            const $target = $(event.target);

            if ($target.is('#mode-btn') ||
                (!$target.is('label') && !$target.is('input') && !$target.is('button'))) {
                this.togglePencilMode();
            }
        });

        // Win
        $('#close-win-btn').click(() => {
            $('#win-popup').fadeOut(200);
            this.newGame();
        });
        // Lose
        $('#close-lose-btn').click(() => {
            $('#lose-popup').fadeOut(200);
            this.resetGame();
        });

        $('#streak-btn').click(() => {
            $('#streak-popup').fadeIn(200);
        });
        $('#close-streak-btn').click(() => {
            $('#streak-popup').fadeOut(200);
        });
        $('#play-today-btn').click(() => {
            if (confirm("Are you sure?  This will clear the current puzzle!")) {
                $('#streak-popup').fadeOut(200);
                this.newGame(null, true);
            }
        });

        // Settings
        $('#settings-btn').click(() => {
            $('#settings-popup').fadeIn(200);
        });
        $('#close-settings-btn').click(() => {
            $('#settings-popup').fadeOut(200);
        });
        $('#apply-seed-btn').click(() => {
            const newSeed = $('#seed-input').val().trim();
            if (newSeed) {
                $('#settings-popup').fadeOut(200);
                this.newGame(newSeed);
            }
        });
        $('#show-current-sums').change(() => {
            this.settings.showSums = $('#show-current-sums').is(':checked');
            this.saveSettings();
            $('body').toggleClass('disable-current-sums', !this.settings.showSums);
        });
        $('#static-grid-size').change(() => {
            this.settings.staticGridSize = $('#static-grid-size').is(':checked');
            this.saveSettings();
            $('#static-grid-size-lbl').toggle(this.settings.staticGridSize);
        });
        $('#static-grid-size-slider').on('input change', () => {
            this.settings.gridSize = parseInt($('#static-grid-size-slider').val());
            this.saveSettings();
            $('#static-grid-size-value').text(this.settings.gridSize);
        });
        $('#static-difficulty').change(() => {
            this.settings.staticDifficulty = $('#static-difficulty').is(':checked');
            this.saveSettings();
            $('#static-difficulty-lbl').toggle(this.settings.staticDifficulty);
        });
        $('#static-difficulty-slider').on('input change', () => {
            this.settings.difficulty = parseInt($('#static-difficulty-slider').val());
            this.saveSettings();
            $('#static-difficulty-value').text(this.settings.difficulty);
        });
    }

    bindCellEvents = function() {
        this.$grid.off('click', '.grid-cell').on('click', '.grid-cell', (e) => {
            const $cell = $(e.currentTarget);

            if ($cell.hasClass('solved')) return;

            const row = $cell.data('row');
            const col = $cell.data('col');
            const notDecoy = !this.state.decoyMap[row][col];

            if (this.state.pencilMode == notDecoy) {
                $cell.addClass('solved');
                this.state.solveMap[row][col] = true;
                this.updateCurrentSums();
            } else {
                $cell.addClass('flash-wrong');
                setTimeout(() => {$cell.removeClass('flash-wrong');}, 300);
                this.updateLives(-1);
            }

            this.saveState();

            e.stopPropagation();
        });
    }

    updateCurrentSums = function() {
        const rowCurSums = Array(this.state.gridSize).fill(0);
        const rowSolvedState = Array(this.state.gridSize).fill(true);
        const colCurSums = Array(this.state.gridSize).fill(0);
        const colSolvedState = Array(this.state.gridSize).fill(true);
        const groupCurSums = Array(this.state.gridSize + 1).fill(0);
        const groupSolvedState = Array(this.state.gridSize + 1).fill(true);
        let solved = true;

        for (let row = 0; row < this.state.gridSize; row++) {
            for (let col = 0; col < this.state.gridSize; col++) {
                const shouldCount = this.state.solveMap[row][col] && !this.state.decoyMap[row][col];
                const value = this.state.numbers[row][col];
                rowCurSums[row] += shouldCount ? value : 0;
                rowSolvedState[row] = rowSolvedState[row] && this.state.solveMap[row][col];
                colCurSums[col] += shouldCount ? value : 0;
                colSolvedState[col] = colSolvedState[col] && this.state.solveMap[row][col];
                groupCurSums[this.state.colorGroupMap[row][col]] += shouldCount ? value : 0;
                groupSolvedState[this.state.colorGroupMap[row][col]] = groupSolvedState[this.state.colorGroupMap[row][col]] && this.state.solveMap[row][col];
                solved = solved && this.state.solveMap[row][col];
            }
        }

        for (let i = 0; i < this.state.gridSize; i++) {
            const $rowSum = $(`.sum-cell.row-${i} .number`);
            const $rowCurSum = $(`.sum-cell.row-${i} .current-sum`);
            $rowCurSum.text(rowCurSums[i]);
            if (rowSolvedState[i]) {
                $rowSum.fadeOut(200, () => $(this).remove());
                $rowCurSum.fadeOut(200, () => $(this).remove());
            }

            const $colSum = $(`.sum-cell.col-${i} .number`);
            const $colCurSum = $(`.sum-cell.col-${i} .current-sum`);
            $colCurSum.text(colCurSums[i]);
            if (colSolvedState[i]) {
                $colSum.fadeOut(200, () => $(this).remove());
                $colCurSum.fadeOut(200, () => $(this).remove());
            }

            const $groupSum = $(`.grid-cell.group${i + 1} .group-sum`);
            const $groupCurSum = $(`.grid-cell.group${i + 1} .current-sum`);
            $groupCurSum.text(groupCurSums[i + 1]);
            if (groupSolvedState[i + 1]) {
                $groupSum.fadeOut(200, () => $(this).remove());
                $groupCurSum.fadeOut(200, () => $(this).remove());
            }
        }

        if (solved) this.wonGame();
    }

    renderGrid = function() {
        this.$grid.css({
            'grid-template-columns': `repeat(${this.state.gridSize + 1}, 1fr)`,
            'grid-template-rows': `repeat(${this.state.gridSize + 1}, 1fr)`
        });
        this.$grid.empty();

        for (let row = 0; row <= this.state.gridSize; row++) {
            for (let col = 0; col <= this.state.gridSize; col++) {
                if (row === 0 && col === 0) {
                    this.$grid.append('<div class="sum-cell empty-cell"></div>');
                } else if (row === 0) {
                    this.$grid.append(
                        `<div class="sum-cell col-${col - 1}" data-col="${col - 1}">
                            <span class="number">${this.state.colSums[col - 1] || 0}</span>
                            <span class="current-sum"></span>
                        </div>`
                    );
                } else if (col === 0) {
                    // Row sum cell with current sum span
                    this.$grid.append(
                        `<div class="sum-cell row-${row - 1}" data-row="${row - 1}">
                            <span class="number">${this.state.rowSums[row - 1] || 0}</span>
                            <span class="current-sum"></span>
                        </div>`
                    );
                } else {
                    const decoy = this.state.decoyMap[row - 1][col - 1] ? 'decoy' : '';
                    const solved = this.state.solveMap[row - 1][col - 1] ? 'solved' : '';
                    this.$grid.append(
                        `<div class="grid-cell ${decoy} ${solved} row-${row - 1} col-${col - 1} group${this.state.colorGroupMap[row - 1][col - 1] || 0}" data-row="${row - 1}" data-col="${col - 1}">
                            <span class="number">${this.state.numbers[row - 1][col - 1]}</span>
                        </div>`
                    );
                }
            }
        }

        for (let groupId = 1; groupId <= this.state.gridSize; groupId++) {
            const $groupSum = this.$grid.find(`.grid-cell.group${groupId}`).first();
            if ($groupSum.length > 0) {
                $groupSum.append(`<span class="group-sum">${this.state.colorGroupSums[groupId]}</span>`);
                $groupSum.append(`<span class="current-sum"></span>`);
            }
        }

        const $currentGame = $('#current-game');
        let level = `Level ${this.state.seed}`;
        if (this.state.isDaily) level += " 📆";
        if (this.state.seed == this.settings.currentLevel) level += " ⚡";
        $currentGame.text(level);

        this.updateCurrentSums();
        this.bindCellEvents();
    }

    generateNumbers = function(rand) {
        const arr = [];
        for (let row = 0; row < this.state.gridSize; row++) {
            arr[row] = [];
            for (let col = 0; col < this.state.gridSize; col++) {
                arr[row][col] = Math.floor((rand ? rand() : Math.random()) * 9) + 1;
            }
        }
        this.state.numbers = arr;
    }

    generateSums = function(rand) {
        const rowSums = Array(this.state.gridSize).fill(0);
        const colSums = Array(this.state.gridSize).fill(0);
        const colorGroupSums = Array(this.state.gridSize + 1).fill(0);

        for (let row = 0; row < this.state.gridSize; row++) {
            for (let col = 0; col < this.state.gridSize; col++) {
                const isDecoy = this.state.decoyMap[row][col];
                const value = this.state.numbers[row][col];
                rowSums[row] += isDecoy ? 0 : value;
                colSums[col] += isDecoy ? 0 : value;
                colorGroupSums[this.state.colorGroupMap[row][col]] += isDecoy ? 0 : value;
            }
        }

        // Ensure no row or column has a sum of 0 to avoid giving away decoys
        for (let row = 0; row < this.state.gridSize; row++) {
            if (rowSums[row] === 0) {
                const col = Math.floor((rand ? rand() : Math.random()) * this.state.gridSize);
                console.warn(`Row ${row} has a sum of 0, switching decoy at column ${col}.`);
                this.state.decoyMap[row][col] = false;
                rowSums[row] = this.state.numbers[row][col];
                colSums[col] += this.state.numbers[row][col];
                colorGroupSums[this.state.colorGroupMap[row][col]] += this.state.numbers[row][col];
            }
        }

        for (let col = 0; col < this.state.gridSize; col++) {
            if (colSums[col] === 0) {
                const row = Math.floor((rand ? rand() : Math.random()) * this.state.gridSize);
                console.warn(`Column ${col} has a sum of 0, switching decoy at row ${row}.`);
                this.state.decoyMap[row][col] = false;
                rowSums[row] += this.state.numbers[row][col];
                colSums[col] = this.state.numbers[row][col];
                colorGroupSums[this.state.colorGroupMap[row][col]] += this.state.numbers[row][col];
            }
        }

        this.state.rowSums = rowSums;
        this.state.colSums = colSums;
        this.state.colorGroupSums = colorGroupSums;
    }

    generateColorGroupMap = function(rand) {
        let groupMap = Array(this.state.gridSize).fill(null).map(() => Array(this.state.gridSize).fill(0));

        if (this.settings.showColorGroups) {
            let maxAttempts = this.state.gridSize * 5;
            for (let groupId = 1; groupId <= this.state.gridSize; groupId++) {
                let row, col;
                while (true) {
                    row = Math.floor((rand ? rand() : Math.random()) * this.state.gridSize);
                    col = Math.floor((rand ? rand() : Math.random()) * this.state.gridSize);
                    if (groupMap[row][col] === 0) break;
                    if (--maxAttempts <= 0) return groupMap;
                }
                const newGroup = {
                    groupId: groupId,
                    count: 1,
                    sum: 0,
                    row: row,
                    col: col,
                    multiRow: false,
                    multiCol: false,
                    map: JSON.parse(JSON.stringify(groupMap))
                };
                this.getColorGroupRecursive(rand, newGroup);

                // Criteria for valid group
                if (newGroup.count >= 3
                    && newGroup.count <= this.state.gridSize
                    && newGroup.multiRow && newGroup.multiCol
                    && newGroup.sum > 0) {
                        groupMap = newGroup.map;
                        console.info(`Group ${groupId} generated with starting cell (${row}, ${col})`);
                } else {
                        console.warn(`Group ${groupId} discarded (count: ${newGroup.count}, multiRow: ${newGroup.multiRow}, multiCol: ${newGroup.multiCol}, sum: ${newGroup.sum})`);
                }
            }
        }

        this.state.colorGroupMap = groupMap;
    }

    getColorGroupRecursive = function(rand, newGroup) {
        newGroup.map[newGroup.row][newGroup.col] = newGroup.groupId;
        if (newGroup.count >= this.state.gridSize) return true;

        let directions = [[-1, 0], [1, 0], [0, -1], [0, 1]].sort(() => (rand ? rand() : Math.random()) - 0.5);
        while (directions.length > 0) {
            const direction = directions.pop();
            const newRow = newGroup.row + (direction[0]);
            const newCol = newGroup.col + (direction[1]);
            if (newRow >= 0 && newRow < this.state.gridSize
                && newCol >= 0 && newCol < this.state.gridSize
                && newGroup.map[newRow][newCol] === 0) {
                newGroup.row = newRow;
                newGroup.col = newCol;
                newGroup.multiRow = newGroup.multiRow || direction[0] !== 0;
                newGroup.multiCol = newGroup.multiCol || direction[1] !== 0;
                newGroup.count++;
                newGroup.sum += this.state.numbers[newRow][newCol];
                this.getColorGroupRecursive(rand, newGroup);
                return;
            }
        }
    }

    generateDecoyMap = function(rand) {
        const sparseRows = [];
        const sparseCols = [];

        for (let row = 0; row < this.state.gridSize; row++)
            sparseRows[row] = (rand ? rand() : Math.random()) > this.settings.difficulty / 10;
        for (let col = 0; col < this.state.gridSize; col++)
            sparseCols[col] = (rand ? rand() : Math.random()) > this.settings.difficulty / 10;

        const decoyMap = [];
        for (let row = 0; row < this.state.gridSize; row++) {
            decoyMap[row] = [];
            for (let col = 0; col < this.state.gridSize; col++) {
                const prob = sparseRows[row] || sparseCols[col] ? this.settings.sparseProbability : this.settings.stdProbability;
                decoyMap[row][col] = (rand ? rand() : Math.random()) < prob;
            }
        }

        this.state.decoyMap = decoyMap;
    }

    generateSolveMap = function() {
        const solveMap = [];
        for (let row = 0; row < this.state.gridSize; row++)
            solveMap[row] = Array(this.state.gridSize).fill(false);
        this.state.solveMap = solveMap;
    }
}

