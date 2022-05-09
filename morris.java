// Implement three mens morris using the board
// Game starts with empty board
// The players have 3 pieces each
// They take turns placing their piece on the board
// The first player to get 3 in a row wins 
// The game ends when there are no more valid moves
import java.util.Scanner;

class morris {
    public static void main(String[] args) {
        gameBoard board = new gameBoard();
        board.printBoard();

        //First phase: placing the pieces
        while (board.getPlaced() > 0) {

            // Prompt player with turn to place a piece
            System.out.println("Player " + board.getTurn() + " place a piece");
            int x = -1;
            int y = -1;
            // Get the x and y coordinates
            while (x < 0 || x > 2) {
                System.out.println("Enter x coordinate: ");
                Scanner input = new Scanner(System.in);
                x = input.nextInt();
            }
            while (y < 0 || y > 2) {
                System.out.println("Enter y coordinate: ");
                Scanner input = new Scanner(System.in);
                y = input.nextInt();
            }
            // If the coordinates are valid, place the piece
            if (board.isEmpty(x, y)) {
                int turn_temp = board.getTurn(); // Doing this because getTurn will chagne after placing a piece
                board.placePiece(x, y);
                // If it was second player's turn, decrement the number of pieces placed
                if (turn_temp == 2) {
                    board.decrementPlaced();
                }
            } else {
                System.out.println("Invalid move");
            }
            board.printBoard();
        }

        // Moving phase. 
        // While no one has won
        // Check whose turn it is and get possible moves.
        // Get from and to locations.
        // Try to make the move. If it returns zero, repeat the procedcture. 
        while (board.checkWin() == 0) {
            // Print dividing line
            System.out.println("-----------------------------------------------------");
            // Print the board
            board.printBoard();
            // Print whose turn it is
            if (board.getTurn() == 1) {
                System.out.println("Player 1's turn");
            } else {
                System.out.println("Player 2's turn");
            }
            // Get possible moves
            int[][] moves = board.getPossibleMoves();
            // Print possible moves
            System.out.println("Possible moves:");
            for (int i = 0; i < 3; i++) {
                for (int j = 0; j < 3; j++) {
                    if (moves[i][j] == 1) {
                        System.out.print("(" + i + ", " + j + ") ");
                    }
                }
                System.out.println();
            }
            // Get from and to locations
            int fromX = -1;
            int fromY = -1;
            int toX = -1;
            int toY = -1;
            // Get the from and to locations
            while (fromX < 0 || fromX > 2) {
                System.out.println("Enter from x coordinate: ");
                Scanner input = new Scanner(System.in);
                fromX = input.nextInt();
            }
            while (fromY < 0 || fromY > 2) {
                System.out.println("Enter from y coordinate: ");
                Scanner input = new Scanner(System.in);
                fromY = input.nextInt();
            }
            while (toX < 0 || toX > 2) {
                System.out.println("Enter to x coordinate: ");
                Scanner input = new Scanner(System.in);
                toX = input.nextInt();
            }
            while (toY < 0 || toY > 2) {
                System.out.println("Enter to y coordinate: ");
                Scanner input = new Scanner(System.in);
                toY = input.nextInt();
            }
            // Try to make the move
            if (board.move(fromX, fromY, toX, toY) == 1) {
                board.printBoard();
            } else {
                System.out.println("Invalid move");
            }
        }
        // Print and congratulate the winner. Exit.
        if (board.checkWin() == 1) {
            System.out.println("Player 1 wins!");
        } else {
            System.out.println("Player 2 wins!");
        }

    }
}