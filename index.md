# 9 Men’s Morris 
(Summer vacation edition)

## Part 0: Installation
* ### Simple Installation 
1.  Go to [Releases](https://github.com/Legedith/9-men-s-morris/releases)
2.  Find the latest release
3.  Download and follow instructions

* ### Building from source
1.  Clone the repo  
              `git clone https://github.com/Legedith/9-men-s-morris.git`
2.  cd into the cloned repo  
              `cd 9-men-s-morris`
3.  Compile using Javac  
              `javac morris.java`
4.  Run the compiled game  
              `java morris`

## Part 1: Analysis of the game 🕵️‍♀️
9 Men’s Morris is a classical 2 person game. 
The game starts with each player having three pieces each. 
The game consists of two phases; the placement phase and the movement phase. It’s won when either player manages to get three pieces in a row.
In the placement phase, the players take turns placing their pieces on the board. Once they run out of pieces, the placement phase begins. 
In the placement phase, the players can pick their pieces and place them at any blank location. 
The one who gets three in a row first wins. 


## Part 2: Design 🎨
For the Design of classes, we thought it wise to split the implementation into two classes. One depicting the game board containing all necessary variables to control and represent the game state, and the other to manage players and implement the rules and peculiarities of the game using the methods and variables of the game board. 
The inspiration for this came from the fact that even in real life, you can play multiple games on the same game board by modifying the rules, the pieces and such. 

_P.s. you can even play a variation of tic-tac-toe on the same game board._


## Part 3: Description of classes 🔧🔨
