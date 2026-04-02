$(document).ready(function() {
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
            stdProbability: 0.25,
            sparseProbability: 0.75,
        };
        const settings = JSON.parse(localStorage.getItem('settings') || '{}');

        this.settings = { ...DEFAULT_SETTINGS, ...settings };
        this.saveSettings();

        $('#show-current-sums').prop('checked', this.settings.showSums);
        $('body').toggleClass('disable-current-sums', !this.settings.showSums);
        $('#static-grid-size').prop('checked', this.settings.staticGridSize);
        $('#static-grid-size-slider').val(this.settings.gridSize);
        $('#static-grid-size-value').text(this.settings.gridSize);
        $('#static-grid-size-lbl').toggle(this.settings.staticGridSize);
        $('#static-difficulty').prop('checked', this.settings.staticDifficulty);
        $('#static-difficulty-slider').val(this.settings.difficulty);
        $('#static-difficulty-value').text(this.settings.difficulty);
        $('#static-difficulty-lbl').toggle(this.settings.staticDifficulty);
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

        $('body').toggleClass('pencilMode', this.state.pencilMode);
    }

    saveState = function() {
        localStorage.setItem('state', JSON.stringify(this.state));
    }

    newGame = function() {
        this.loadSettings();
        this.state = {
            gridSize: parseInt(this.settings.gridSize),
            pencilMode: true,
            lives: 3,
            maxLives: 3,
        };
        this.state.numbers = this.getNumbers();
        this.state.decoyMap = this.getDecoyMap();
        this.state.solveMap = this.getSolveMap();
        this.generateSums();
        this.saveState();

        this.renderGrid();
        this.updateLives();
    }

    updateLives = function(value) {
        if (typeof value === "number") this.state.lives += value;

        const $lives = $('#lives');
        let livesText = "";
        for (let i = 0; i < this.state.lives; i++) livesText += "❤️";
        for (let i = this.state.lives; i < this.state.maxLives; i++) livesText += "🤍";
        $lives.html(livesText);
        console.info(`Lives: ${this.state.lives}`);

        if (this.state.lives <= 0) {
        }
    }

    bindButtonEvents = function() {
        $('body').bind('click', (event) => {
            const $target = $(event.target);

            if ($target.is('#mode-btn') ||
                (!$target.is('label') && !$target.is('input') && !$target.is('button'))) {
                this.state.pencilMode = !this.state.pencilMode;
                $('body').toggleClass('pencilMode', this.state.pencilMode);
                this.saveState();
                console.info(`Mode: ${this.state.pencilMode ? 'Pencil' : 'Eraser'}`);
            }
        });

        // Win
        $('#close-win-btn').click(() => {
            $('#win-popup').fadeOut(200);
            this.newGame();
        });

        // Settings
        $('#settings-btn').click(() => {
            $('#settings-popup').fadeIn(200);
        });
        $('#close-settings-btn').click(() => {
            $('#settings-popup').fadeOut(200);
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
        let unsolved = false;
        for (let i = 0; i < this.state.gridSize; i++) {
            let rowSum = 0, colSum = 0;
            for (let j = 0; j < this.state.gridSize; j++) {
                rowSum += this.state.solveMap[i][j] ? this.state.numbers[i][j] : 0;
                colSum += this.state.solveMap[j][i] ? this.state.numbers[j][i] : 0;
                unsolved = unsolved || !this.state.solveMap[i][j];
            }

            const $rowSum = $(`.sum-cell.row-${i} .current-sum`);
            $rowSum.text(rowSum);
            const $colSum = $(`.sum-cell.col-${i} .current-sum`);
            $colSum.text(colSum);
        }

        if (!unsolved) $('#win-popup').fadeIn(200);
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
                    // Add data attributes for row/col and decoy status
                    this.$grid.append(
                        `<div class="grid-cell ${decoy} ${solved} row-${row - 1} col-${col - 1}" data-row="${row - 1}" data-col="${col - 1}">
                            <span class="number">${this.state.numbers[row - 1][col - 1]}</span>
                        </div>`
                    );
                }
            }
        }

        this.updateCurrentSums();
        this.bindCellEvents();
    }

    getNumbers = function(rand) {
        const arr = [];
        for (let row = 0; row < this.state.gridSize; row++) {
            arr[row] = [];
            for (let col = 0; col < this.state.gridSize; col++) {
                arr[row][col] = Math.floor((rand ? rand() : Math.random()) * 9) + 1;
            }
        }
        return arr;
    }

    generateSums = function() {
        const rowSums = Array(this.state.gridSize).fill(0);
        const colSums = Array(this.state.gridSize).fill(0);

        for (let row = 0; row < this.state.gridSize; row++) {
            for (let col = 0; col < this.state.gridSize; col++) {
                rowSums[row] += this.state.decoyMap[row][col] ? 0 : this.state.numbers[row][col];
                colSums[col] += this.state.decoyMap[row][col] ? 0 : this.state.numbers[row][col];
            }
        }

        this.state.rowSums = rowSums;
        this.state.colSums = colSums;
    }

    getDecoyMap = function() {
        const sparseRows = [];
        const sparseCols = [];

        for (let row = 0; row < this.state.gridSize; row++)
            sparseRows[row] = Math.random() > this.settings.difficulty / 10;
        for (let col = 0; col < this.state.gridSize; col++)
            sparseCols[col] = Math.random() > this.settings.difficulty / 10;

        const decoyMap = [];
        for (let row = 0; row < this.state.gridSize; row++) {
            decoyMap[row] = [];
            for (let col = 0; col < this.state.gridSize; col++) {
                const prob = sparseRows[row] || sparseCols[col] ? this.settings.sparseProbability : this.settings.stdProbability;
                decoyMap[row][col] = Math.random() < prob;
            }
        }
        return decoyMap;
    }

    getSolveMap = function() {
        const solveMap = [];
        for (let row = 0; row < this.state.gridSize; row++)
            solveMap[row] = Array(this.state.gridSize).fill(false);
        return solveMap;
    }
}

