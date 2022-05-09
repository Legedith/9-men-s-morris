public class gameBoard {
    private int[][] board;
    private int turn;
    private int winner;
    private int placed;

    // Constructor
    public gameBoard() {
        board = new int[3][3];
        turn = 1;
        winner = 0;
        placed = 3;
        // Fill te board with zeros
        for (int i = 0; i < 3; i++) {
            for (int j = 0; j < 3; j++) {
                board[i][j] = 0;
            }
        }
    }

    // Function to place a piece on the board
    public void placePiece(int x, int y) {
        if (board[x][y] == 0) {
            board[x][y] = turn;
            turn = turn % 2 + 1;
        } else {
            System.out.println("Invalid move");
        }
    }
    
    // Function to check if any player has 3 in a row, column, or diagonal
    // Board will have 1 for player 1, 2 for player 2, and 0 for empty
    // Returns 1 if player 1 wins, 2 if player 2 wins, 0 if no one wins
    public int checkWin() {
        // Check rows
        for (int i = 0; i < 3; i++) {
            if (board[i][0] == board[i][1] && board[i][1] == board[i][2]) {
                if (board[i][0] == 1) {
                    return 1;
                } else if (board[i][0] == 2) {
                    return 2;
                }
            }
        }
        // Check columns
        for (int i = 0; i < 3; i++) {
            if (board[0][i] == board[1][i] && board[1][i] == board[2][i]) {
                if (board[0][i] == 1) {
                    return 1;
                } else if (board[0][i] == 2) {
                    return 2;
                }
            }
        }
        // Check diagonals
        if (board[0][0] == board[1][1] && board[1][1] == board[2][2]) {
            if (board[0][0] == 1) {
                return 1;
            } else if (board[0][0] == 2) {
                return 2;
            }
        }
        if (board[0][2] == board[1][1] && board[1][1] == board[2][0]) {
            if (board[0][2] == 1) {
                return 1;
            } else if (board[0][2] == 2) {
                return 2;
            }
        }

        // No one has won
        return 0;
    }
    // Function to move player from one space to another
    // Takes player number, the position to move to and the position to move from
    // Returns 1 if move is successful, 0 if not
    public int move(int fromRow, int fromCol, int toRow, int toCol) {
        // Check if move is valid
        // Print value at board to and from for debugging
        System.out.println("toRow: " + toRow + " toCol: " + toCol + " fromRow: " + fromRow + " fromCol: " + fromCol);
        System.out.println(board[fromRow][fromCol]);
        System.out.println("");
        System.out.println(board[toRow][toCol]);
        System.out.println("");
        
        if (board[toRow][toCol] != 0 || board[fromRow][fromCol] == 0) {
            return 0;
        }
        // Check if the player to be moved has the turn
        // Print turn and the piece at from location  // for debugging
        System.out.println("Turn: " + turn);
        System.out.print("Piece at: (" + fromRow + ", " + fromCol + ")  :");
        System.out.println(board[fromRow][fromCol]);
        System.out.println("");
        if (board[fromRow][fromCol] != turn) {
            return 0;
        }
        // Move player
        board[toRow][toCol] = board[fromRow][fromCol];
        board[fromRow][fromCol] = 0;
        // Change turn
        turn = turn % 2 + 1;
        return 1;
    }
    // Check whose turn it is
    public int getTurn() {
        return turn;
    }
    // Set the turn
    public void setTurn(int turn) {
        this.turn = turn;
    }
    // Get possible moves for the current player
    public int[][] getPossibleMoves() {
        int[][] moves = new int[3][3];
        // Check if any moves are possible
        for (int i = 0; i < 3; i++) {
            for (int j = 0; j < 3; j++) {
                if (board[i][j] == 0) {
                    moves[i][j] = 1;
                } else {
                    moves[i][j] = 0;
                }
            }
        }
        return moves;
    }
    // Get the winner
    public int getWinner() {
        return winner;
    }
    // Check if the position on board is empty
    public boolean isEmpty(int row, int col) {
        if (board[row][col] == 0) {
            return true;
        } else {
            return false;
        }
    }
    // Print the board with stars for empty spaces dashes for lines
    public void printBoard() {
        for (int i = 0; i < 3; i++) {
            for (int j = 0; j < 3; j++) {
                if (board[i][j] == 0) {
                    System.out.print("* ");
                } else if (board[i][j] == 1) {
                    System.out.print("X ");
                } else if (board[i][j] == 2) {
                    System.out.print("O ");
                }
            } 
            System.out.println();
        }
    }
    // Get the number of pieces placed
    public int getPlaced() {
        return placed;
    }
    // Decrement placed after both players have placed their piece
    public void decrementPlaced() {
        placed--;
    }
}
