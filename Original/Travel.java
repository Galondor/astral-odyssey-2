package Main;
import java.util.Arrays;
import java.util.InputMismatchException;
import java.util.Random;
import java.util.Scanner;

import Enemies.EnemyGeneration;
import Loot.Accessories;
import Loot.Armor;
import Loot.Generation;
import Loot.Weapon;
import Player.Player;
import Player.Variables;
import Player.Inventory;
import Player.ClassType;

public class Travel {
    private String location;
    private int locationNumber;
    private int timesTraveled;
    private int previousCase;
    private String previousLocation;
    private Boolean groupOfBandits = false;
    private Boolean diciplesOfXolgroth = false;
    private Boolean watchCommander = false;

    public String getLocation() { return location; }
    public int getLocationNumber() { return locationNumber; }
    public int getTimesTraveled() { return timesTraveled; }

    public Boolean getGroupOfBandits() { return groupOfBandits; }
    public Boolean getDiciplesOfXolgroth() { return diciplesOfXolgroth; }
    public Boolean getWatchCommander() { return watchCommander; }

    public void setLocation(String location) { this.location = location; }
    public void setLocationNumber(int locationNumber) { this.locationNumber = locationNumber; }
    public void setTimesTraveled(int timesTraveled) { this.timesTraveled = timesTraveled; }
    public void setGroupOfBandits(Boolean groupOfBandits) { this.groupOfBandits = groupOfBandits; }
    public void setDiciplesOfXolgroth(Boolean diciplesOfXolgroth) { this.diciplesOfXolgroth = diciplesOfXolgroth; }
    public void setWatchCommander(Boolean watchCommander) { this.watchCommander = watchCommander; }

    public void traveling() {
        Player player = App.getPlayer();
        Variables variables = App.getVariables();
        setTimesTraveled(timesTraveled + 1);
        Random random = new Random();
        Scanner scanner = new Scanner(System.in);
        int randomNumber = 0;

        if (player.getStamina() <= 0) {
            System.out.println("You are too tired to continue.");
            System.out.println("You may rest at the inn in town to restore your stamina.\n"
            + "or you may use a stamina potion to restore your stamina.");
            System.out.println("1. Continue");

            scanner.next();
            App.clearScreen();
            App.actionMenu();
            scanner.close();

        }  else if (player.getStamina() > 0) {
            player.setStamina(player.getStamina() - 1);
        }

        if (getTimesTraveled() > 15) {
            changeLocation();
        }

        if (variables != null && variables.getIsAdmin() == true) {
            System.out.println("Where would you like to go?");
            System.out.println("1. Admin Travel\n"
            + "2. Standard Travel\n");
        
            int choice = scanner.nextInt();
            App.clearScreen();

            switch (choice) {
                case 1:
                    adminTravel();
                    break;
                case 2:
                    break;
            }
        }

        switch (getLocationNumber()) {
        case 1:
            randomNumber = random.nextInt(15) + 1;
            while (randomNumber == previousCase) {
                randomNumber = random.nextInt(15) + 1;
            }
            previousLocation = "Forest";
            if (randomNumber > 10) {
                forestEvents(randomNumber);
            } else {
                standardEvents(randomNumber);
            }
            break;
        case 2:
            randomNumber = random.nextInt(15) + 1;
            while (randomNumber == previousCase) {
                randomNumber = random.nextInt(15) + 1;
            }
            previousLocation = "Swamp";
            if (randomNumber > 10) {
                swampEvents(randomNumber);
            } else {
                standardEvents(randomNumber);
            }
            break;
        case 3:
            randomNumber = random.nextInt(15) + 1;
            while (randomNumber == previousCase) {
                randomNumber = random.nextInt(15) + 1;
            }
            previousLocation = "Badlands";
            if (randomNumber > 10) {
                badlandsEvents(randomNumber);
            } else {
                standardEvents(randomNumber);
            }
            break;
        case 4:
            randomNumber = random.nextInt(15) + 1;
            while (randomNumber == previousCase) {
                randomNumber = random.nextInt(15) + 1;
            }
            previousLocation = "Ocean";
            if (randomNumber > 10) {
                oceanEvents(randomNumber);
            } else {
                standardEvents(randomNumber);
            }
            break;
        case 5:
            randomNumber = random.nextInt(15) + 1;
            while (randomNumber == previousCase) {
                randomNumber = random.nextInt(15) + 1;
            }
            previousLocation = "Volcano";
            if (randomNumber > 10) {
                volcanoEvents(randomNumber);
            } else {
                standardEvents(randomNumber);
            }
            break;
        case 6:
            randomNumber = random.nextInt(15) + 1;
            while (randomNumber == previousCase) {
                randomNumber = random.nextInt(15) + 1;
            }
            previousLocation = "Mountain";
            if (randomNumber > 10) {
                mountainEvents(randomNumber);
            } else {
                standardEvents(randomNumber);
            }
            break;
        case 7:
            randomNumber = random.nextInt(15) + 1;
            while (randomNumber == previousCase) {
                randomNumber = random.nextInt(15) + 1;
            }
            previousLocation = "Desert";
            if (randomNumber > 10) {
                desertEvents(randomNumber);
            } else {
                standardEvents(randomNumber);
            }
            break;
        case 8:
            randomNumber = random.nextInt(15) + 1;
            while (randomNumber == previousCase) {
                randomNumber = random.nextInt(15) + 1;
            }
            previousLocation = "Warzone";
            if (randomNumber > 10) {
                warzoneEvents(randomNumber);
            } else {
                standardEvents(randomNumber);
            }
            break;
        }
    }

    public void adminTravel() {
        Scanner scanner = new Scanner(System.in);
        int choice = 0;

        System.out.println("Where would you like to go?");
        System.out.println("1. Forest\n"
            + "2. Swamp\n"
            + "3. Badlands\n"
            + "4. Ocean\n"
            + "5. Volcano\n"
            + "6. Mountain\n"
            + "7. Desert\n"
            + "8. Warzone\n"
            + "9. Standard Events\n"
        );

        choice = scanner.nextInt();
        App.clearScreen();

        switch (choice) {
             case 1:
                setLocation("Forest");
                setLocationNumber(1);
                System.out.println("You are now in the " + getLocation() + ".");
                System.out.println("Which event would you like to go to?");
                System.out.println("11. Bear Attack");
                System.out.println("12. Merchant");
                System.out.println("13. Watchtower");
                System.out.println("14. Jack The Lumberjack");
                System.out.println("15. Enchanted Forest");
                choice = scanner.nextInt();
                App.clearScreen();
                forestEvents(choice);
                break;
            case 2:
                setLocation("Swamp");
                setLocationNumber(2);
                System.out.println("You are now in the " + getLocation() + ".");
                System.out.println("Which event would you like to go to?");
                System.out.println("11. Poisoned Dwarf");
                System.out.println("12. Loch Ness Monster");
                System.out.println("13. Swamp Fever");
                System.out.println("14. Swamp Fog (Salruth)");
                System.out.println("15. Witch");
                choice = scanner.nextInt();
                App.clearScreen();
                swampEvents(choice);
                break;
            case 3:
                setLocation("Badlands");
                setLocationNumber(3);
                System.out.println("You are now in the " + getLocation() + ".");
                System.out.println("Which event would you like to go to?");
                System.out.println("11. Tumbleweed");
                System.out.println("12. Loose Footing");
                System.out.println("13. Mining Outpost");
                System.out.println("14. Canyon & Bull");
                System.out.println("15. Dust Devil");
                choice = scanner.nextInt();
                App.clearScreen();
                badlandsEvents(choice);
                break;
            case 4:
                setLocation("Ocean");
                setLocationNumber(4);
                System.out.println("You are now in the " + getLocation() + ".");
                System.out.println("Which event would you like to go to?");
                System.out.println("11. Leviathan");
                System.out.println("12. Whirlpool");
                System.out.println("13. Pirates");
                System.out.println("14. Fishing");
                System.out.println("15. Land Ho!");
                choice = scanner.nextInt();
                App.clearScreen();
                oceanEvents(choice);
                break;
            case 5:
                setLocation("Volcano");
                setLocationNumber(5);
                System.out.println("You are now in the " + getLocation() + ".");
                System.out.println("Which event would you like to go to?");
                System.out.println("11. Eruption");
                System.out.println("12. Collapsed Bridge");
                System.out.println("13. Infernal Fire Demon");
                System.out.println("14. Atop The Volcano");
                System.out.println("15. Zolgadiyun");
                choice = scanner.nextInt();
                App.clearScreen();
                volcanoEvents(choice);
                break;
            case 6:
                setLocation("Mountain");
                setLocationNumber(6);
                System.out.println("You are now in the " + getLocation() + ".");
                System.out.println("Which event would you like to go to?");
                System.out.println("11. Mining Cave");
                System.out.println("12. Avalanche/Temple of The Gods");
                System.out.println("13. Frozen Elf (Amelia)");
                System.out.println("14. Dwarven Forge");
                System.out.println("15. Ice Dragon (Vadhulath)");
                choice = scanner.nextInt();
                App.clearScreen();
                mountainEvents(choice);
                break;
            case 7:
                setLocation("Desert");
                setLocationNumber(7);
                System.out.println("You are now in the " + getLocation() + ".");
                System.out.println("Which event would you like to go to?");
                System.out.println("11. Pyramid");
                System.out.println("12. Mummy");
                System.out.println("13. Oasis");
                System.out.println("14. Quicksand");
                System.out.println("15. Deathworm");
                choice = scanner.nextInt();
                App.clearScreen();
                desertEvents(choice);
                break;
            case 8:
                setLocation("Warzone");
                setLocationNumber(8);
                System.out.println("You are now in the " + getLocation() + ".");
                System.out.println("Which event would you like to go to?");
                System.out.println("11. Soldier");
                System.out.println("12. Lieutenant");
                System.out.println("13. General");
                System.out.println("14. Leader");
                System.out.println("15. Merchant");
                choice = scanner.nextInt();
                App.clearScreen();
                warzoneEvents(choice);
                break;
            case 9:
                System.out.println("Which event would you like to go to?");
                System.out.println("1. Enemy");
                System.out.println("2. Gold");
                System.out.println("3. Nothing");
                System.out.println("4. Enemy");
                System.out.println("5. Path");
                System.out.println("6. Rest");
                System.out.println("7. Enemy");
                System.out.println("8. Outpost");
                System.out.println("9. Fairy/Bridge");
                System.out.println("10. Enemy");
                choice = scanner.nextInt();
                App.clearScreen();
                standardEvents(choice);
                break;
        }
    }

    public void changeLocation() {
        App.clearScreen();
        Variables variables = App.getVariables();
        Random random = new Random();
        Scanner scanner = new Scanner(System.in);
        int randomNumber = random.nextInt(8) + 1;


        switch (randomNumber) {
            case 1:
                setLocation("Forest");
                setLocationNumber(1);
                System.out.println("You are now in the " + getLocation() + ".");
                break;
            case 2:
                setLocation("Swamp");
                setLocationNumber(2);
                System.out.println("You are now in the " + getLocation() + ".");
                break;
            case 3:
                setLocation("Badlands");
                setLocationNumber(3);
                System.out.println("You are now in the " + getLocation() + ".");
                break;
            case 4:
                setLocation("Ocean");
                setLocationNumber(4);
                System.out.println("You are now in the " + getLocation() + ".");
                break;
            case 5:
                setLocation("Volcano");
                setLocationNumber(5);
                System.out.println("You are now in the " + getLocation() + ".");
                break;
            case 6:
                setLocation("Mountain");
                setLocationNumber(6);
                System.out.println("You are now in the " + getLocation() + ".");
                break;
            case 7:
                setLocation("Desert");
                setLocationNumber(7);
                System.out.println("You are now in the " + getLocation() + ".");
                break;
            case 8:
                setLocation("Warzone");
                setLocationNumber(8);
                System.out.println("You are now in the " + getLocation() + ".");
                break;
        }
        System.out.println("1. Continue");
        scanner.next();
        App.clearScreen();
        setTimesTraveled(0);
        variables.setTimesLocationChanged(variables.getTimesLocationChanged() + 1);
        App.actionMenu();
        scanner.close();
    }

    public void standardEvents(int eventNumber) {
        Scanner scanner = new Scanner(System.in);
        Random random = new Random();
        Player player = App.getPlayer();
        Variables variables = App.getVariables();
        Inventory inventory = App.getInventory();
        EnemyGeneration enemyGeneration = App.getEnemyGeneration();
        Bots npc = new Bots();

        int choice = 0;
        switch (eventNumber) {
            case 1:
                previousCase = 1;
                enemyGeneration.generateEnemy("Standard");
                break;
            case 2:

                int goldAmount = random.nextInt(500) + 1;
                System.out.println("During your travels you trip over something in the ground.\n"
                + " You look down and to your surprise you see a small bag of gold!");
                System.out.println("You found " + goldAmount + " gold!");
                player.setGold(player.getGold() + goldAmount);
                System.out.println("1. Continue");
                scanner.next();
                break;
            case 3:
                previousCase = 3;
                System.out.println("You travel for a while and find nothing of interest.");
                System.out.println("1. Continue");
                scanner.next();
                break;
            case 4:
                previousCase = 4;
                enemyGeneration.generateEnemy("Standard");
                break;
            case 5:
                previousCase = 5;
                System.out.println("After traveling for a while you notice a path leading off the main road.\n"
                + "Do you follow the path?\n"
                + "1. Yes\n" 
                + "2. No\n");
                choice = scanner.nextInt();
                App.clearScreen();
                if (choice == 1) {
                    System.out.println("You follow the path...");
                    int path = random.nextInt(4) + 1;
                    if (path == 1) {
                        groupOfBandits = true;                      
                        enemyGeneration.generateEnemy("Group of Bandits");
                    } else if (path == 2) {
                        if (variables.getXolgrothDead() == false) {
                            System.out.println("You come across a demonic ritual taking place.\n" 
                            + "The cultists see you and attempt to sacrifice you to their god!\n");
                            System.out.println("1. Fight Back\n"
                            + "2. I am also enlightened by the great Xolgroth!\n" 
                            + "3. Run Away\n");
                            choice = scanner.nextInt();
                            App.clearScreen();
                            switch (choice) {
                                case 1:
                                    System.out.println("Cultists: You dare defy the great Xolgroth!\n"
                                    + "You prepare for battle!");
                                    System.out.println("1. Continue");
                                    scanner.next();
                                    App.clearScreen();
                                    diciplesOfXolgroth = true;
                                    enemyGeneration.generateEnemy("Diciples of Xolgroth");
                                    break;
                                case 2:
                                    npc.diciplesOfXolgroth();
                                case 3:
                                    int getAway = random.nextInt(2) + 1;
                                    System.out.println("Cultists: You dare defy the great Xolgroth!\n"
                                    + "You attempt to run away!");
                                    System.out.println("1. Continue");
                                    scanner.next();
                                    App.clearScreen();
                                    if (getAway == 1) {
                                        System.out.println("You manage to escape!");
                                        System.out.println("1. Continue");
                                        scanner.next();
                                    } else if (getAway == 2) {
                                        System.out.println("You are caught and prepare to battle the cultists!");
                                        System.out.println("1. Continue");
                                        scanner.next();
                                        App.clearScreen();
                                        diciplesOfXolgroth = true;
                                        enemyGeneration.generateEnemy("Diciples of Xolgroth");
                                    }
                                    break;
                            }
                        } else {
                            System.out.println("You come across the remains of a demonic ritual, it seems after Xolgroth's death his followers have disbanded.");
                            System.out.println("You look around the area and find a Demon Heart!");
                            inventory.addMaterialToInventory("Demon Heart", 1);
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                        }
                    } else if (path == 3) {
                        System.out.println("You come across a small chest!");
                        inventory.setHealthPotion(inventory.getHealthPotion() + 1);
                        inventory.setStaminaPotion(inventory.getStaminaPotion() + 1);
                        inventory.setPowerPotion(inventory.getPowerPotion() + 1);
                        System.out.println("Inside you find 1 Health, Stamina, & Power Potion!");
                        System.out.println("1. Continue");
                        scanner.next();
                    } else if (path == 4) {
                        App.clearScreen();
                        //int npcEvent = random.nextInt(1);
                        int npcEvent = 1;
                        npcEvents(npcEvent);
                    }
                } else if (choice == 2) {
                    System.out.println("You continue on your way.");
                    System.out.println("1. Continue");
                    scanner.next();
                }
                break;
            case 6:
                previousCase = 6;
                System.out.println("You travel for a long time and grow tired.\n"
                + "You decide to rest for a while in a nice clearing nearby.\n"
                + "You set up camp and rest for a while.");
                player.setStamina(player.getStamina() + player.getMaxStamina() / 4);
                if (player.getStamina() > player.getMaxStamina()) {
                    player.setStamina(player.getMaxStamina());
                }
                System.out.println("You have restored some of your stamina: " + player.getStamina() + " / " + player.getMaxStamina());
                System.out.println("1. Continue");
                scanner.next();
                break;
            case 7:
                previousCase = 7;
                enemyGeneration.generateEnemy("Standard");
                break;
            case 8:
                previousCase = 8;
                System.out.println("You travel for a while and come across an old militia outpost.\n");
                System.out.println("1. Enter the outpost");
                System.out.println("2. Continue on your way");

                choice = scanner.nextInt();
                App.clearScreen();
                if (choice == 1) {
                    System.out.println("You enter the outpost and are greeted by a guard.\n"
                    + "Ramona: Hello there, my name is Ramona what brings you to this outpost?\n");
                    System.out.println("1. I am just passing through.\n"
                    + "2. I am looking to get stronger.\n"
                    + "3. I am looking for a place to rest.\n"
                    + "4. I am looking for work.\n");
                    choice = scanner.nextInt();
                    App.clearScreen();
                    switch (choice) {
                        case 1:
                            System.out.println("Ramona: Carry on then.\n");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            break;
                        case 2:
                            System.out.println("Ramona: Well you've come to the right place!\n"
                            + "I'll train you myself!\n"
                            + "The last person I sparred with didn't make it past round 2, hahaha!\n");
                            System.out.println("1. Let's do this!\n"
                            + "2. I don't think I'm ready for this...");
                            choice = scanner.nextInt();
                            App.clearScreen();
                            if (choice == 1) {
                                int spar = random.nextInt(3) + 1;
                                System.out.println("You prepare to spar with Ramona!");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                if (spar == 1) {
                                    System.out.println("You manage to defeat Ramona!");
                                    System.out.println("Ramona: Well done! You are a worthy opponent!\n");
                                    player.setStatPoints(player.getStatPoints() + 1);
                                    player.setAttributePoints(player.getAttributePoints() + 1);
                                    System.out.println("You gain 1 stat & attribute point!");
                                    System.out.println("1. Continue");
                                    scanner.next();
                                    App.clearScreen();
                                } else if (spar == 2) {
                                    System.out.println("You are defeated by Ramona!");
                                    System.out.println("Ramona: Better luck next time!\n");
                                    System.out.println("1. Continue");
                                    scanner.next();
                                    App.clearScreen();
                                } else if (spar == 3) {
                                    System.out.println("You and Ramona tie!");
                                    System.out.println("Ramona: You're one tough cookie, but so am I hahaha!\n");
                                    player.setStatPoints(player.getStatPoints() + 1);
                                    System.out.println("You gain 1 stat point!");
                                    System.out.println("1. Continue");
                                    scanner.next();
                                    App.clearScreen();
                                }
                                //combat
                            } else if (choice == 2) {
                                System.out.println("Ramona: Well then, come back when you are ready.");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                            }
                            break;
                        case 3:
                            int gold = random.nextInt(500) + 1;
                            gold = gold * player.getLevel();

                            System.out.println("Ramona: Hmm, for a small fee I can let you rest here for the night.");
                            System.out.println("1. pay " + gold + " gold to rest here");
                            System.out.println("2. I'll pass");
                            choice = scanner.nextInt();
                            App.clearScreen();
                            if (choice == 1) {
                                if (player.getGold() >= gold) {
                                    System.out.println("You pay " + gold + " gold to rest here for the night.");
                                    player.setGold(player.getGold() - gold);
                                    player.setTotalGoldSpent(player.getTotalGoldSpent() + gold);
                                    System.out.println("1. Continue");
                                    scanner.next();
                                    App.clearScreen();
                                    System.out.println("You rest for the night and wake up feeling refreshed!");
                                    player.setHealth(player.getMaxHealth());
                                    player.setStamina(player.getMaxStamina());
                                    player.setPower(player.getPowerMax());
                                    System.out.println("1. Continue");
                                    scanner.next();
                                    App.clearScreen();
                                } else {
                                    System.out.println("You do not have enough gold to rest here.");
                                    System.out.println("1. Continue");
                                    scanner.next();
                                    App.clearScreen();
                                }
                            } else if (choice == 2) {
                                System.out.println("Ramona: Well then, come back when you are ready.");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                            }
                            break;
                        case 4:
                            System.out.println("Ramona: Sorry we don't have any work at the moment.\n" 
                            + "The last guy we hired was killed by a group of bandits...\n" 
                            + "But surely you can find work in Town at the Quest Board!\n");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            break;
                    }
                } else if (choice == 2) {
                    System.out.println("You continue on your way.");
                    System.out.println("1. Continue");
                    scanner.next();
                    App.clearScreen();
                }
                break;
            case 9:
                previousCase = 9;
                if (player.getLevel() == 1) {
                    System.out.println("In your travels you see a rather particular butterfly.\n"
                    + "You decide to follow it and it leads you to a small cave.\n"
                    + "You enter the cave and find a pile of bones...\n"
                    + "The butterfly lands on the pile of bones and transforms into a fairy!\n"
                    + "Fairy: Hello there, I am Felicia, the fairy of death! >:)");
                    System.out.println("You are filled with fear and prepare to run away!\n"
                    + "Fairy: Don't be afraid, I am not here to hurt you.\n"
                    + "I am here to grant you a wish!\n"
                    + "You may choose to increase one stat in exchange for -12 of your Maximum Health\n");
                    System.out.println("Current Health: " + player.getHealth() + " / " + player.getMaxHealth() + "\n");
                    System.out.println("1. Increase Strength\n"
                    + "2. Increase Dexterity\n"
                    + "3. Increase Intelligence\n"
                    + "4. Increase Vitality\n"
                    + "5. Increase Resilience\n"
                    + "6. Bye Felicia\n");
                    try {
                        choice = scanner.nextInt();
                        App.clearScreen();
                    } catch (InputMismatchException e) {
                        scanner.next(); // clear the scanner buffer
                        App.clearScreen();
                        standardEvents(9);
                    }
                    App.clearScreen();
                    int pointsUsed = 0;
                    switch (choice) {
                        case 1:
                            System.out.println("How many points would you like to increase your Strength by?");
                            pointsUsed = scanner.nextInt();
                            if (pointsUsed * 12 >= player.getMaxHealth()) {
                                System.out.println("Oh sweetest, you do not have enough Maximum Health to exchange for that many points. ;(");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                break;
                            } else {
                                player.setStrength(player.getStrength() + pointsUsed);
                                player.setMaxHealth(player.getMaxHealth() - (pointsUsed * 12));
                                if (player.getHealth() > player.getMaxHealth()) {
                                    player.setHealth(player.getMaxHealth());
                                }
                                System.out.println("You have increased your Strength by " + pointsUsed + " and is now " + player.getStrength() + "\n"
                                + "Your Maximum Health has been decreased by " + (pointsUsed * 12) + " and is now " + player.getMaxHealth() + "!");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                break;
                            }
                        case 2:
                            System.out.println("How many points would you like to increase your Dexterity by?");
                            pointsUsed = scanner.nextInt();
                            if (pointsUsed * 12 >= player.getMaxHealth()) {
                                System.out.println("Oh sweetest, you do not have enough Maximum Health to exchange for that many points. ;(");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                break;
                            } else {
                                player.setDexterity(player.getDexterity() + pointsUsed);
                                player.setMaxHealth(player.getMaxHealth() - (pointsUsed * 12));
                                if (player.getHealth() > player.getMaxHealth()) {
                                    player.setHealth(player.getMaxHealth());
                                }
                                System.out.println("You have increased your Dexterity by " + pointsUsed + " and is now " + player.getDexterity() + "\n"
                                + "Your Maximum Health has been decreased by " + (pointsUsed * 12) + " and is now " + player.getMaxHealth() + "!");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                break;
                            }
                        case 3:
                            System.out.println("How many points would you like to increase your Intelligence by?");
                            pointsUsed = scanner.nextInt();
                            if (pointsUsed * 12 >= player.getMaxHealth()) {
                                System.out.println("Oh sweetest, you do not have enough Maximum Health to exchange for that many points. ;(");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                break;
                            } else {
                                player.setIntelligence(player.getIntelligence() + pointsUsed);
                                player.setMaxHealth(player.getMaxHealth() - (pointsUsed * 12));
                                if (player.getHealth() > player.getMaxHealth()) {
                                    player.setHealth(player.getMaxHealth());
                                }
                                System.out.println("You have increased your Intelligence by " + pointsUsed + " and is now " + player.getIntelligence() + "\n"
                                + "Your Maximum Health has been decreased by " + (pointsUsed * 12) + " and is now " + player.getMaxHealth() + "!");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                break;
                            }
                        case 4:
                            System.out.println("How many points would you like to increase your Vitality by?");
                            pointsUsed = scanner.nextInt();
                            if (pointsUsed * 12 >= player.getMaxHealth()) {
                                System.out.println("Oh sweetest, you do not have enough Maximum Health to exchange for that many points. ;(");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                break;
                            } else {
                                player.setVitality(player.getVitality() + pointsUsed);
                                player.setMaxHealth(player.getMaxHealth() - (pointsUsed * 12));
                                if (player.getHealth() > player.getMaxHealth()) {
                                    player.setHealth(player.getMaxHealth());
                                }
                                System.out.println("You have increased your Vitality by " + pointsUsed + " and is now " + player.getVitality() + "\n"
                                + "Your Maximum Health has been decreased by " + (pointsUsed * 12) + " and is now " + player.getMaxHealth() + "!");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                break;
                            }
                        case 5:
                            System.out.println("How many points would you like to increase your Resilience by?");
                            pointsUsed = scanner.nextInt();
                            if (pointsUsed * 12 >= player.getMaxHealth()) {
                                System.out.println("Oh sweetest, you do not have enough Maximum Health to exchange for that many points. ;(");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                break;
                            } else {
                                player.setResilience(player.getResilience() + pointsUsed);
                                player.setMaxHealth(player.getMaxHealth() - (pointsUsed * 12));
                                if (player.getHealth() > player.getMaxHealth()) {
                                    player.setHealth(player.getMaxHealth());
                                }
                                System.out.println("You have increased your Resilience by " + pointsUsed + " and is now " + player.getResilience() + "\n"
                                + "Your Maximum Health has been decreased by " + (pointsUsed * 12) + " and is now " + player.getMaxHealth() + "!");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                break;
                            }
                        case 6:
                            System.out.println("You leave the cave and continue on your way.");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            break;
                    }

                } else {
                    System.out.println("You travel for a while and find an old bridge.\n"
                    + "1. Cross the bridge\n"
                    + "2. Turn back");
                    try {
                        choice = scanner.nextInt();
                        App.clearScreen();
                    } catch (InputMismatchException e) {
                        scanner.next(); // clear the scanner buffer
                        App.clearScreen();
                        standardEvents(9);
                    }
                    App.clearScreen();
                    if (choice == 1) {
                        int randBridge = random.nextInt(5) + 1;
                        int foundItemAmount = random.nextInt(5) + 1;
                        int foundGoldAmount = random.nextInt(500) + 1;
                        String found = "";
                        switch (randBridge) {
                            case 1:
                                found = "Stamina Potion";
                                inventory.setStaminaPotion(inventory.getStaminaPotion() + foundItemAmount);

                                break;
                            case 2:
                                found = "Health Potion";
                                inventory.setHealthPotion(inventory.getHealthPotion() + foundItemAmount);
                                break;
                            case 3:
                                found = "Gold";
                                player.setGold(player.getGold() + foundGoldAmount);
                                break;
                            case 4:
                                found = "Stat Point";
                                player.setStatPoints(player.getStatPoints() + 1);
                                break;
                            case 5:
                                found = "Enemy";
                                break;
                        }
                        System.out.println("You cross the bridge and find...");
                        if (found == "Enemy") {
                            enemyGeneration.generateEnemy("Standard");
                        } else if (found == "Gold") {
                            System.out.println("A small sack containing " + foundGoldAmount + " gold!");
                        } else if (found == "Stat Point") {
                            System.out.println("An old book buried in the dirt. You read the book and gain 1 " + found + "!");
                        } else {
                            System.out.println("A small crate containing " + foundItemAmount + " " + found + "s!");
                        }
                        System.out.println("1. Continue");
                        scanner.next();
                        App.clearScreen();
                    } else if (choice == 2) {
                        System.out.println("You turn back and continue on your way.");
                        System.out.println("1. Continue");
                        scanner.next();
                        App.clearScreen();
                    }
                }
                break;
            case 10:
                previousCase = 10;
                enemyGeneration.generateEnemy("Standard");
                break;
        }
        App.actionMenu();
        scanner.close();
    }

    public void forestEvents(int eventNumber) {
        Scanner scanner = new Scanner(System.in);
        Random random = new Random();
        Player player = App.getPlayer();
        Inventory inventory = App.getInventory();
        Accessories ring = App.getRings();
        ClassType classType = App.getClassType();
        EnemyGeneration enemyGeneration = App.getEnemyGeneration();
        int choice = 0;

        switch (eventNumber) {
            case 11:
                previousCase = 11;
                int mauls = random.nextInt(3) + 1;
                System.out.println("You travel for a while and hear a rustling in the bushes.");
                System.out.println("As you approach the bushes a small rabbit jumps out and runs away.");
                System.out.println("You continue on your way...");
                System.out.println("Bear: RAWR!");
                System.out.println("A bear jumps out of the bushes and charges you!");
                System.out.println("1. Defend Yourself!");
                System.out.println("2. Run Away!");
                choice = scanner.nextInt();
                App.clearScreen();

                if (choice == 1) {
                    int fight = random.nextInt(3) + 1;
                    if (fight == 2) {
                        int bearToothAmount = random.nextInt(5) + 2;
                        player.setAttributePoints(player.getAttributePoints() + 2);
                        inventory.addMaterialToInventory("Bear Tooth", bearToothAmount);
                        System.out.println("You manage to defeat the bear!");
                        System.out.println("You scavenge the bear's corpse and find " + bearToothAmount + " Bear Tooth!");
                        System.out.println("You also gain 2 Attribute Point!");
                        System.out.println("1. Continue");
                        scanner.next();
                        App.clearScreen();
                        App.actionMenu();
                    } else if (fight == 1 || fight == 3) {
                        switch (mauls) {
                            case 1:
                                player.setAttackMax(player.getAttackMax() - 10);
                                if (player.getAttackMax() < 0) { player.setAttackMax(0); }
                                System.out.println("The bear mauls your arm!");
                                System.out.println("Your max attack has been decreased by 10!");
                                System.out.println("1. Continue");
                                break;
                            case 2:
                                if (player.getLevel() != 1) {
                                    player.setMaxStamina(player.getMaxStamina() - 5);
                                    if (player.getMaxStamina() < 0) { player.setMaxStamina(0); }
                                    System.out.println("The bear mauls your leg!");
                                    System.out.println("Your max stamina has been decreased by 5!");
                                    System.out.println("1. Continue");
                                    break;
                                } else {
                                    player.setMaxStamina(player.getMaxStamina() - 1);
                                    if (player.getMaxStamina() < 0) { player.setMaxStamina(0); }
                                    System.out.println("The bear mauls your leg!");
                                    System.out.println("Your max stamina has been decreased by 1!");
                                    System.out.println("1. Continue");
                                    break;
                                }
                            case 3:
                                player.setMaxHealth(player.getMaxHealth() - 10);
                                if (player.getHealth() > player.getMaxHealth()) {
                                    player.setHealth(player.getMaxHealth());
                                }
                                if (player.getMaxHealth() < 0) { player.setMaxHealth(0); }
                                System.out.println("The bear mauls your side!");
                                System.out.println("Your max health has been decreased by 10!");
                                System.out.println("1. Continue");
                                break;
                        }
                        scanner.next();
                        App.actionMenu();
                    }
                } else if (choice == 2) {
                    int getAway = random.nextInt(2) + 1;
                    if (getAway == 1) {
                        System.out.println("You manage to escape!");
                        System.out.println("1. Continue");
                        scanner.next();
                    } else if (getAway == 2) {
                        switch (mauls) {
                            case 1:
                                player.setAttackMax(player.getAttackMax() - 10);
                                if (player.getAttackMax() < 0) { player.setAttackMax(0); }
                                System.out.println("You are caught and the bear mauls your arm!");
                                System.out.println("Your max attack has been decreased by 10!");
                                System.out.println("1. Continue");
                                break;
                            case 2:
                                player.setMaxStamina(player.getMaxStamina() - 5);
                                if (player.getMaxStamina() < 0) { player.setMaxStamina(0); }
                                System.out.println("You are caught and the bear mauls your leg!");
                                System.out.println("Your max stamina has been decreased by 5!");
                                System.out.println("1. Continue");
                                break;
                            case 3:
                                player.setMaxHealth(player.getMaxHealth() - 10);
                                if (player.getHealth() > player.getMaxHealth()) {
                                    player.setHealth(player.getMaxHealth());
                                }
                                if (player.getMaxHealth() < 0) { player.setMaxHealth(0); }
                                System.out.println("You are caught and the bear mauls your side!");
                                System.out.println("Your max health has been decreased by 10!");
                                System.out.println("1. Continue");
                                break;
                        }
                    }
                    scanner.next();
                    App.actionMenu();
                }
                break;
            case 12:
                previousCase = 12;
                System.out.println("During your travels you encouter a traveling merchant.");
                System.out.println("Merchant: Hello weary traveler, could i interest you in some trinkets?");
                System.out.println("1. Yes\n" + "2. No");
                choice = scanner.nextInt();
                App.clearScreen();
                switch (choice) {
                    case 1:
                        System.out.println("Gold: " + player.getGold() + "g");
                        System.out.println("0. Leave");
                        System.out.println("1. Random Ring [1000 Gold]");
                        System.out.println("2. Merchant's Bangle [75,000 Gold]");
                        choice = scanner.nextInt();
                        App.clearScreen();
                        switch (choice) {
                            case 0:
                                break;
                            case 1:
                                if (player.getGold() >= 1000) {
                                    System.out.println("Merchant: A fine choice!");
                                    player.setGold(player.getGold() - 1000);
                                    player.setTotalGoldSpent(player.getTotalGoldSpent() + 1000);
                                    Generation.createRing("Standard", false);
                                    // Set ring = to the newly created ring
                                    int index = inventory.getGear().length - 1;
                                    ring = (Accessories) inventory.getGear()[index];
                                    System.out.println("You have purchased a " + ring.getName() + "!");
                                } else if (player.getGold() < 1000) {
                                    System.out.println("Merchant: What a shame, you don't have enough gold.");
                                }
                                break;
                            case 2:
                                if (player.getGold() >= 75000) {
                                    System.out.println("Merchant: A superb choice!");
                                    player.setGold(player.getGold() - 75000);
                                    player.setTotalGoldSpent(player.getTotalGoldSpent() + 75000);
                                    Generation.createRing("Merchant's Bangle", false);
                                    // Set ring = to the newly created ring
                                    int index = inventory.getGear().length - 1;
                                    ring = (Accessories) inventory.getGear()[index];
                                    System.out.println("You have purchased the Merchant's Bangle!");
                                }
                                else if (player.getGold() < 75000) {
                                    System.out.println("Merchant: What a shame, you don't have enough gold.");
                                }
                                break;
                        }
                        break;
                    case 2:
                        System.out.println("Merchant: Well I will be on my way then.");
                        break;
                    default:
                        System.out.println("Merchant: Well I will be on my way then.");
                        break;
                }
                System.out.println("1. Continue");
                scanner.next();
                App.clearScreen();
                App.actionMenu();
                break;
            case 13:
                previousCase = 13;
                System.out.println("While traveling in the forest you can see a Watchtower in the distance.\n" + "Do you go to the Watchtower?");
                System.out.println("1. Yes\n" + "2. No");

                choice = scanner.nextInt();
                App.clearScreen();

                if (choice == 1) {
                    System.out.println("You approach the Watchtower and see a few guards standing outside.");
                    System.out.println("1. Approach The Guards\n" + "2. Sneak Past The Guards\n" + "3. Turn Back");

                    choice = scanner.nextInt();
                    App.clearScreen();
                    switch (choice) {
                        case 1:
                            if (classType.getClassName() == "Knight") {
                                System.out.println("Guard 1: Halt! Who goes there?\n" + "Guard 2: Whoa they're one of us let him through.\n" + "Guard 1: Carry on then.");
                                System.out.println("You enter the Watchtower and are greeted by a Knight.");
                                System.out.println("The Knight thanks you for your service and gives you a gift.");
                                System.out.println("You gain 1000g Gold & 1 Attribute Point!");
                                player.setGold(player.getGold() + 1000);
                                player.setAttributePoints(player.getAttributePoints() + 1);
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();

                            } else  {
                                System.out.println("Guard 1: I don't know you, get out of here!\n" + "Guard 2: Yeah, scram!\n" + "Guard 1: Or else we'll make you!\n");
                                System.out.println("You are forced to leave the Watchtower.");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                            }
                        case 2:
                            int sneak = random.nextInt(2) + 1; 
                            if (classType.getDangerSenseUnlocked() == true) { sneak = 2; }
                            if (sneak == 2) {
                                System.out.println("You manage to sneak past the guards and enter the Watchtower.");
                                System.out.println("You stealthily search the Watchtower and find the Watch Commander's office.");
                                System.out.println("You find go inside and see the Watch Commander asleep at his desk.");
                                System.out.println("You see a personal safe behind the Watch Commander's desk.");
                                System.out.println("1. Attempt to open the safe\n" + "2. Assassinate The Watch Commander\n" + "3. Leave the Watchtower");
                                choice = scanner.nextInt();
                                App.clearScreen();
                                switch (choice) {
                                    case 1:
                                        int openSafe = random.nextInt(8) + 1;
                                        if (openSafe == 5) {
                                            Generation.createRing("Standard", false);
                                            int index = inventory.getGear().length - 1;
                                            ring = (Accessories) inventory.getGear()[index];
                                            System.out.println("You manage to open the safe and find 5000g Gold & a " + ring.getName() + "!");
                                            player.setGold(player.getGold() + 5000);
                                            System.out.println("1. Continue");
                                            scanner.next();
                                            App.clearScreen();
                                            App.actionMenu();
                                        } else {
                                            System.out.println("You fail to open the safe and decide to leave while you still can.");
                                            System.out.println("1. Continue");
                                            scanner.next();
                                            App.clearScreen();
                                            App.actionMenu();
                                        }
                                        break;
                                    case 2:
                                        int assassinate = random.nextInt(5) + 1; 
                                        if (classType.getAssassinateUnlocked() == true) {
                                            assassinate = random.nextInt(5) + classType.getAssassinateUpgrade();
                                            if (assassinate > 10) { assassinate = 10; }
                                            System.out.println("You use Assassinate to assassinate the Watch Commander!");
                                        }
                                        if (assassinate == 5) {
                                            Generation.createRing("Watch Commander's Helmet", false);
                                            int index = inventory.getGear().length - 1;
                                            ring = (Accessories) inventory.getGear()[index];
                                            System.out.println("You manage to assassinate the Watch Commander and loot his body.");
                                            System.out.println("You find 10000g Gold & the " + ring.getName() + "!"); 
                                            player.setGold(player.getGold() + 10000);
                                            System.out.println("1. Continue");
                                            scanner.next();
                                            App.clearScreen();
                                            App.actionMenu();
                                        } else {
                                            System.out.println("You fail to assassinate the Watch Commander!");
                                            System.out.println("The Watch Commander comes to his senses and attacks you!");
                                            System.out.println("1. Fight!");
                                            scanner.next();
                                            App.clearScreen();
                                            watchCommander = true;
                                            enemyGeneration.generateEnemy("Watch Commander");
                                        }
                                    case 3:
                                        System.out.println("You leave the Watchtower.");
                                        System.out.println("1. Continue");
                                        scanner.next();
                                        App.clearScreen();
                                        App.actionMenu();
                                }
                            } else {
                                System.out.println("You fail to sneak past the guards and are forced to leave the Watchtower.");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                            }
                        case 3:
                            System.out.println("You continue on your way.");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                    }
                } else {
                    System.out.println("You continue on your way.");
                    System.out.println("1. Continue");
                    scanner.next();
                    App.clearScreen();
                    App.actionMenu();
                }
                break;
            case 14:
                previousCase = 14;
                String tree = "";
                int reqStrength = 0;
                if (player.getLevel() < 25) {
                    tree = "Tree";
                    reqStrength = random.nextInt(50) + 1;
                } else if (player.getLevel() >= 25 && player.getLevel() < 50) {
                    tree = "Elder Tree";
                    reqStrength = random.nextInt(100) + 25;
                } else if (player.getLevel() >= 50 && player.getLevel() < 75) {
                    tree = "Beanstalk";
                    reqStrength = random.nextInt(250) + 50;
                } else if (player.getLevel() >= 75 && player.getLevel() < 100) {
                    tree = "Deku Tree";
                    reqStrength = random.nextInt(500) + 100;
                } else if (player.getLevel() >= 100) {
                    tree = "World Tree";
                    reqStrength = random.nextInt(1000) + 250;
                }
                if (classType.getHeavySwingUnlocked() == true) { reqStrength = reqStrength / 2; }

                System.out.println("You're walking through the forest and head a loud chopping sound.");
                System.out.println("You follow the sound and come across a lumberjack.");
                System.out.println("Jack: Hey there partner, I'm Jack the lumberjack.");
                System.out.println("Jack: Yanno I could use some help chopping down this here " + tree);
                System.out.println("1. Take a swing at the " + tree + " (REQ STR: " + reqStrength + ")" + "\n" + "2. Goodbye Jack");
                choice = scanner.nextInt();
                App.clearScreen();
                switch (choice) {
                    case 1:
                        if (classType.getHeavySwingUnlocked() == true) {
                            System.out.println("You use Heavy Swing to chop tree!");
                        } else {
                            System.out.println("You swing at the " + tree + " with all your might!");
                        }
                        if (player.getStrength() >= reqStrength) {
                            int woodAmount = random.nextInt(5) + 5;
                            System.out.println("You manage to chop down the " + tree + "!");
                            System.out.println("Jack: Well I'll be, you're a strong one!");
                            System.out.println("Jack: Here take this, you've earned it!");
                            System.out.println("You gain 1 Attribute Point!");
                            System.out.println("You gain " + woodAmount + " Wood!");
                            inventory.addMaterialToInventory("Wood", woodAmount);
                            player.setAttributePoints(player.getAttributePoints() + 1);
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                        } else {
                            System.out.println("You barely managed a dent in the " + tree + "!");
                            System.out.println("Jack: Hey it's okay! Chopping down trees isn't for everyone.");
                            System.out.println("Jack: I gotta get back to work, see ya around!");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                        }
                        break;
                    case 2:
                        System.out.println("You continue on your way.");
                        System.out.println("1. Continue");
                        scanner.next();
                        App.clearScreen();
                        App.actionMenu();
                        break;
                }
                App.actionMenu();
                break;
            case 15:
                previousCase = 15;
                System.out.println("You travel for a while and the further you travel the more magical the forest becomes.");
                System.out.println("You come across a small clearing and meet a Earth Nymph.");
                System.out.println("Nymph: Oh traveler, I need your help!");
                System.out.println("Nymph: My sisters and my home has been overrun with corruption!");
                System.out.println("Nymph: The only way to stop the spread of corruption is burn it all away!");
                System.out.println("Nymph: As you can tell i'm not very good with fire, so I need your help!");
                System.out.println("1. I will burn away the corruption\n" + "2. I can't help you, good luck");
                choice = scanner.nextInt();
                App.clearScreen();
                switch (choice) {
                    case 1:
                        int corruption = random.nextInt(100) + 1;
                        if (classType.getFireballUnlocked() == true) {
                            corruption = corruption + classType.getFireballUpgrade();
                            System.out.println("You use Fireball to burn away the corruption!");
                        }
                        if (corruption > 100) { corruption = 100; }
                        else if (corruption < 0) { corruption = 0; }
                        System.out.println("You burn away " + corruption + "% of the corruption!");

                        if (corruption == 0) {
                            System.out.println("Nymph: Thanks for trying, but it looks like we're doomed...");
                        } else if (corruption > 0 && corruption <= 25) {
                            System.out.println("Nymph: That's a good start, but we need to burn away more of the corruption!");
                        } else if (corruption >= 26 && corruption <= 50) {
                            System.out.println("Nymph: We're getting there, but we need to burn away more of the corruption!");
                        } else if (corruption >= 51 && corruption <= 75) {
                            System.out.println("Nymph: That's a lot of corruption gone but my sisters and I still can't return home!");
                            System.out.println("Nymph: Take this as a token of my gratitude!");
                            System.out.println("You gain 1 Attribute Point!");
                            player.setAttributePoints(player.getAttributePoints() + 1);
                        } else if (corruption >= 76 && corruption <= 99) {
                            boolean hasBlessing = false;
                            for (String blessing : player.getBlessings()) {
                                if (blessing.equals("The Forest")) {
                                    hasBlessing = true;
                                    break;
                                }
                            }
                            if (!hasBlessing) {
                                String[] newBlessings = Arrays.copyOf(player.getBlessings(), player.getBlessings().length + 1);
                                newBlessings[newBlessings.length - 1] = "The Forest";
                                player.setBlessings(newBlessings);

                                player.setMaxHealth(player.getMaxHealth() + 100);
                                player.setDefense(player.getDefense() + 10);
                                player.setMaxStamina(player.getMaxStamina() + 5);

                                System.out.println("Nymph: You did it! Thank you so so much!");
                                System.out.println("Nymph: I will be forever in your debt!");
                                System.out.println("Nymph: Allow me to give you my blessing!");
                                System.out.println("You are blessed by the Earth Nymph with the Blessing of the Forest!");
                                System.out.println("Your max health has been increased by 100!");
                                System.out.println("Your defense has been increased by 10!");
                                System.out.println("Your max stamina has been increased by 5!");
                            } else {
                                System.out.println("Nymph: You did it! Thank you so so much!");
                                System.out.println("Nymph: I will be forever in your debt!");
                                System.out.println("Nymph: It seems you already have my blessing, so instead take this!");
                                System.out.println("You gain 2 Attribute Points & 5 Stat Points!");
                                player.setAttributePoints(player.getAttributePoints() + 2);
                                player.setStatPoints(player.getStatPoints() + 5);
                            }

                        } else if (corruption == 100) {
                            Generation.createRing("Nymph's Heart", false);
                            int index = inventory.getGear().length - 1;
                            ring = (Accessories) inventory.getGear()[index];
                            System.out.println("Nymph: You did it! Thank you so so much!");
                            System.out.println("Nymph: I will be forever in your debt!");
                            System.out.println("Nymph: Please take this as a token of my gratitude!");
                            System.out.println("Nymph: It is made with one of my sister's heart, she was corrupted and I had to kill her...");
                            System.out.println("Nymph: So I turned her heart into a ring, it should prove useful on your journey!");
                            System.out.println("You've aquired the " + ring.getName() + "!");
                        }
                        System.out.println("1. Continue");
                        scanner.next();
                        App.clearScreen();
                        App.actionMenu();
                        break;
                    case 2:
                        System.out.println("Nymph: Pfft, I didn't need your help anyways!");
                        System.out.println("1. Continue");
                        scanner.next();
                        App.clearScreen();
                        App.actionMenu();
                        break;
                }

                System.out.println("1. Continue");
                scanner.next();
                App.actionMenu();
                break;
        }
        scanner.close();
    }

    public void swampEvents(int eventNumber) {
        Scanner scanner = new Scanner(System.in);
        Random random = new Random();
        Player player = App.getPlayer();
        Variables variables = App.getVariables();
        Inventory inventory = App.getInventory();
        Accessories ring = App.getRings();
        ClassType classType = App.getClassType();
        EnemyGeneration enemyGeneration = App.getEnemyGeneration();
        Bots npc = new Bots();
        int choice = 0;

        switch (eventNumber) {
            case 11:
                previousCase = 11;
                System.out.println("You manage to find your way back on the main path through the swamp.");
                System.out.println("A few steps later you hear a painful groan.");
                System.out.println("You move towards the noise and find a dwarf laying up against a tree.");
                System.out.println("Dwarf: Oh taveler, please help me!");
                System.out.println("1. How can I help?\n" + "2. I don't have time for this");
                choice = scanner.nextInt();
                App.clearScreen();
                switch (choice) {
                    case 1:
                        System.out.println("Dwarf: I was poisoned by a swamp snake and I need an antidote!");
                        System.out.println("Dwarf: Please, I'm begging you!");
                        System.out.println("1. Give the dwarf 1 Health Potion\n" + "2. Give the dwarf 1 Elixir\n" + "3. Leave the dwarf to die");
                        choice = scanner.nextInt();
                        App.clearScreen();
                        switch (choice) {
                            case 1:
                                if (inventory.getHealthPotion() >= 1) {
                                    inventory.setHealthPotion(inventory.getHealthPotion() - 1);
                                    int reward = random.nextInt(2) + 1;
                                    int gold = random.nextInt(1000) + 1;
                                    System.out.println("You give the dwarf a Health Potion.");
                                    System.out.println("Dwarf: Thank you so much!");
                                    System.out.println("Dwarf: Here take this, I owe you my life!");
                                    if (reward == 1) {
                                        System.out.println("You gain 1 Attribute Point!");
                                        player.setAttributePoints(player.getAttributePoints() + 1);
                                    } else if (reward == 2) {
                                        System.out.println("You gain " + gold + " Gold!");
                                        player.setGold(player.getGold() + gold);
                                    }
                                } else {
                                    System.out.println("You don't have a Health Potion to give the dwarf, so he dies.");
                                }
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                                break;
                            case 2:
                                if (inventory.getElixir() >= 1) {
                                    inventory.setElixir(inventory.getElixir() - 1);
                                    int reward = random.nextInt(2) + 1;
                                    int gold = random.nextInt(5000) + 500;
                                    System.out.println("You give the dwarf an Elixir.");
                                    System.out.println("The dwarf drinks the Elixir and suddenly transforms into a giant!");
                                    System.out.println("Dwarf/Giant: Ahh, I feel more like myself now!");
                                    System.out.println("Giant: Thank you for restoring me to my true form! Take this to remember me by!");
                                    if (reward == 1) {
                                        System.out.println("You gain 2 Attribute Point!");
                                        player.setAttributePoints(player.getAttributePoints() + 2);
                                    } else if (reward == 2) {
                                        System.out.println("You gain " + gold + " Gold!");
                                        player.setGold(player.getGold() + gold);
                                    }
                                } else {
                                    System.out.println("You don't have an Elixir to give the dwarf, so he dies.");
                                }
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                                break;
                            case 3:
                                System.out.println("You leave the dwarf to die and continue on your way.");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                                break;
                        }
                        break;
                    case 2:
                        System.out.println("You leave the dwarf to die and continue on your way.");
                        System.out.println("1. Continue");
                        scanner.next();
                        App.clearScreen();
                        App.actionMenu();
                        break;
                }
                App.clearScreen();
                App.actionMenu();
                break;
            case 12:
                previousCase = 12;
                System.out.println("You travel through the swamp and notice the water infront of you is bubbling.");
                System.out.println("You approach the bubbling water and something jumps out at you!");
                System.out.println("1. Defend Yourself!");
                scanner.next();
                App.clearScreen();
                enemyGeneration.generateEnemy("Loch Ness Monster");
                break;
            case 13:
                previousCase = 13;
                System.out.println("Your travel grows slower and slower, and the swamp appears more... swampy.");
                System.out.println("You fall to your knees, exhausted and dehydrated.");
                System.out.println("You realize that you are experiencing the effects of Swamp Fever.");
                System.out.println("You need to find a cure or you will die!\n");
                System.out.println("You need 2 Rosemary &  1 Lavender to make a cure.");
                inventory.viewMaterial("Rosemary");
                inventory.viewMaterial("Lavender");
                System.out.println("1. Continue");
                if (inventory.getMaterialAmount("Rosemary") >= 2 && inventory.getMaterialAmount("Lavender") >= 1) {
                    System.out.println("2. Make a cure");
                }
                choice = scanner.nextInt();
                App.clearScreen();
                if (choice == 2) {
                    if (inventory.getMaterialAmount("Rosemary") >= 2 && inventory.getMaterialAmount("Lavender") >= 1) {
                        inventory.removeMaterialFromInventory("Rosemary", 2);
                        inventory.removeMaterialFromInventory("Lavender", 1);
                        player.setAttributePoints(player.getAttributePoints() + 1);

                        System.out.println("You make a cure for Swamp Fever!");
                        System.out.println("You gain 1 Attribute Point!");
                        System.out.println("1. Continue");
                        scanner.next();
                        App.clearScreen();
                        App.actionMenu();
                        break;
                    } else {
                        System.out.println("You don't have enough materials to make a cure!");
                        System.out.println("Your max health has been reduced by 15%!");
                        player.setMaxHealth(player.getMaxHealth() - (player.getMaxHealth() / 100 * 15));
                        if (player.getHealth() > player.getMaxHealth()) { player.setHealth(player.getMaxHealth());}
                        System.out.println("1. Continue");
                        scanner.next();
                        App.clearScreen();
                        App.actionMenu();
                        break;
                    }
                } else if (choice == 1) {
                    int medicine = random.nextInt(2) + 1;
                    switch (medicine) {
                        case 1:
                            int rosemary = random.nextInt(7) + 2;
                            int lavender = random.nextInt(4) + 1;

                            System.out.println("You manage to find some Rosemary & Lavender and make a cure for Swamp Fever!");
                            System.out.println("You forage for more Rosemary & Lavendar:");
                            System.out.println("You gain " + rosemary + " Rosemary!");
                            System.out.println("You gain " + lavender + " Lavender!");
                            System.out.println("You gain 3 Stat Points!");

                            player.setStatPoints(player.getStatPoints() + 3);
                            inventory.addMaterialToInventory("Rosemary", rosemary);
                            inventory.addMaterialToInventory("Lavender", lavender);

                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                            break;
                        case 2:
                            System.out.println("You don't find enough materials to make a cure!");
                            System.out.println("Your max health has been reduced by 15%!");
                            player.setMaxHealth(player.getMaxHealth() - (player.getMaxHealth() / 100 * 15));
                            if (player.getHealth() > player.getMaxHealth()) { player.setHealth(player.getMaxHealth());}
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                            break;
                    }
                }
                break;
            case 14:
                previousCase = 14;
                System.out.println("During your travel through the swamp your visibility begins to slowly decrease.");
                System.out.println("Eventually you find yourself lost in a thick swampy fog.");
                System.out.println("You hear a voice in the distance...");
                System.out.println("Voice: Follow my voice, I will lead you to safety lost one.");
                System.out.println("1. Follow the voice\n" + "2. Find your own way out");

                choice = scanner.nextInt();
                App.clearScreen();

                switch (choice) {
                    case 1:
                        int trust = 0;
                        System.out.println("You follow the voice...");
                        System.out.println("Voice: Do you trust me lost one?");
                        System.out.println("1. Yes\n" + "2. No");
                        if (classType.getDangerSenseUnlocked() == true) { System.out.println("Your Danger Sense is urging you to say Yes!"); }

                        choice = scanner.nextInt();
                        App.clearScreen();
                        if (choice == 1) { trust++; }

                        System.out.println("You travel for a while longer until the voice speaks again...");
                        System.out.println("Voice: Do you know who I am lost one?");
                        System.out.println("1. Yes\n" + "2. No");
                        if (variables.getXolgrothBlessing() == true) { System.out.println("3. You're Xolgroth's younger sister Salruth"); }

                        choice = scanner.nextInt();
                        App.clearScreen();
                        if (choice == 1) { trust++; }
                        if (choice == 3) { trust = trust + 2; }

                        System.out.println("You continue on until the voice speaks again...");
                        System.out.println("Voice: Do you love me lost one?");
                        System.out.println("1. Yes\n" + "2. No");

                        choice = scanner.nextInt();
                        App.clearScreen();
                        if (choice == 1) { trust++; }

                        System.out.println("You follow the voice until you see a figure in the distance.");
                        System.out.println("Voice: You're almost here lost one, just a little further.");
                        System.out.println("You approach the figure and as you get closer you make it out to be a woman.");
                        System.out.println("You stop infront of the woman realizing she is the source of the voice.\n");
                        System.out. println("Woman: Take my hand lost one, and be free of this place.");
                        System.out.println("1. Take her hand");

                        scanner.next();
                        App.clearScreen();

                        switch (trust) {
                            case 0:
                                System.out.println("You blink as you take her hand and suddenly you're out of the fog.");
                                System.out.println("Infront of you is a  demonic woman with a sinister smile.");
                                System.out.println("Salruth: You're no fun lost one, I was hoping you'd be more trusting.");
                                System.out.println("Salruth: I guess I'll just have to kill you instead!");
                                System.out.println("You ready yourself for combat!");
                                System.out.println("1. Fight");
                                scanner.next();
                                App.clearScreen();
                                enemyGeneration.generateEnemy("Salruth");
                                break;
                            case 1:
                                int rosemary = random.nextInt(7) + 2;
                                int lavender = random.nextInt(4) + 1;
                                System.out.println("You blink as you take her hand and suddenly you're out of the fog.");
                                System.out.println("Voice: You satisfied my amusement lost one, take these for your travels.");
                                inventory.addMaterialToInventory("Rosemary", rosemary);
                                inventory.addMaterialToInventory("Lavender", lavender);
                                System.out.println("You gain " + rosemary + " Rosemary!");
                                System.out.println("You gain " + lavender + " Lavender!");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                            case 2:
                                int gold = random.nextInt(5000) + 500;
                                System.out.println("You blink as you take her hand and suddenly you're out of the fog.");
                                System.out.println("Voice: You satisfied my amusement lost one, take this for your travels.");
                                System.out.println("You gain " + gold + " Gold!");
                                player.setGold(player.getGold() + gold);
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                            case 3:
                                System.out.println("You blink as you take her hand and suddenly you're out of the fog.");
                                if (variables.getSalruthBlessing() == false) {
                                    String[] newBlessings = Arrays.copyOf(player.getBlessings(), player.getBlessings().length + 1);
                                    newBlessings[newBlessings.length - 1] = "Salruth's Acolyte";
                                    player.setBlessings(newBlessings);
                                    variables.setSalruthBlessing(true);

                                    player.setMaxHealth(player.getMaxHealth() + 100);
                                    player.setPowerMax(player.getPowerMax() + 10);
                                    player.setStrength(player.getStrength() + 15);
                                    player.setDexterity(player.getDexterity() + 15);
                                    player.setIntelligence(player.getIntelligence() + 15);

                                    System.out.println("Salruth: You've proven yourself, I bestow upon you my blessing.");
                                    System.out.println("Salruth blesses you with the Blessing of Salruth's Acolyte!");
                                    System.out.println("Your max health has been increased by 100!");
                                    System.out.println("Your max power has been increased by 10!");
                                    System.out.println("All Stats (STR/DEX/INT) have been increased by 15!");
                                } else {
                                    System.out.println("Salruth: You've proven yourself, I bestow upon you my blessing.");
                                    System.out.println("Salruth: Oh wait, you already have my blessing...");
                                    System.out.println("Salruth: Well I guess you can have this instead!");
                                    System.out.println("You gain 2 Attribute Points & 5 Stat Points!");
                                    player.setAttributePoints(player.getAttributePoints() + 2);
                                    player.setStatPoints(player.getStatPoints() + 5);
                                }
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                                break;
                            case 4:
                                System.out.println("You blink as you take her hand and suddenly you're out of the fog.");
                                System.out.println("Salruth: So you know of my brother... Ah you have his blessing.");
                                System.out.println("Salruth: I shall reward you for your loyalty diciple.");
                                System.out.println("Salruth: Make good use of this.");

                                Generation.createRing("Salruth's Shadow", false);
                                int index = inventory.getGear().length - 1;
                                ring = (Accessories) inventory.getGear()[index];

                                System.out.println("You've aquired " + ring.getName() + "!");
                                System.out.println("1. Continue");
                                scanner.next();
                                ring = null;
                                App.clearScreen();
                                App.actionMenu();
                                break;
                        }
                    case 2:
                        int lost = random.nextInt(3) + 1;
                            System.out.println("You ignore the voice and continue to wander through the fog.");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                        if (lost == 1) {
                            System.out.println("After hours of wandering through the fog you finally find your way out.");
                            System.out.println("Due to exhaustion your health & stamina has been halved!");
                            System.out.println("1. Continue");
                            player.setHealth(player.getHealth() / 2);
                            player.setStamina(player.getStamina() / 2);
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                            break;
                        } else if (lost == 2) {
                            int stolenGold = random.nextInt(player.getGold() / 2) + 1;
                            System.out.println("You wander through the fog for what feels like weeks...");
                            System.out.println("You eventually collapse from exhaustion!");
                            System.out.println("You wake up outside of the swamp fog, you notice a note in your pocket.");
                            System.out.println("The note reads: 'In exchange for saving your life I helped myself to some of your gold.'");
                            System.out.println("You lose " + stolenGold + " Gold!");
                            player.setGold(player.getGold() - stolenGold);
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                            break;
                        } else if (lost == 3) {
                            System.out.println("You wander through the fog for a while and actually manage to find your way out!");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                            break;
                        }
                        break;
                }
                System.out.println("1. Continue");
                scanner.next();
                App.actionMenu();
                break;
            case 15:
                previousCase = 15;
                System.out.println("You travel through the swamp and notice a small shack in the distance.");
                System.out.println("1. Approach \n" + "2. Ignore");

                choice = scanner.nextInt();
                App.clearScreen();

                if (choice == 1) {
                    npc.witch();
                }
                else if (choice == 2) {
                    int witchmad = random.nextInt(2) + 1;
                    if (witchmad == 1) {
                        System.out.println("You continue on your way.");
                        System.out.println("1. Continue");
                        scanner.next();
                        App.clearScreen();
                        App.actionMenu();
                        break;
                    } else if (witchmad == 2) {
                        System.out.println("Witch: You dare ignore me!?");
                        System.out.println("The witch strikes you with a curse!");
                        System.out.println("Your max health has been reduced by 10%!");
                        System.out.println("1. Continue");
                        player.setMaxHealth(player.getMaxHealth() - (player.getMaxHealth() / 100 * 10));
                        if (player.getHealth() > player.getMaxHealth()) { player.setHealth(player.getMaxHealth());}
                        scanner.next();
                        App.clearScreen();
                        App.actionMenu();
                        break;
                    }
                }
                break;
        }
        scanner.close();
    }

    public void badlandsEvents(int eventNumber) {
        Scanner scanner = new Scanner(System.in);
        Random random = new Random();
        Player player = App.getPlayer();
        Inventory inventory = App.getInventory();
        ClassType classType = App.getClassType();
        EnemyGeneration enemyGeneration = App.getEnemyGeneration();
        int choice = 0;

        switch (eventNumber) {
            case 11:
                previousCase = 11;
                int dust = random.nextInt(6) + 1;
                System.out.println("You travel through the badlands and a tumbleweed rolls past you.");
                System.out.println("The tumbleweed left behind " + dust + " Dust...");
                System.out.println("You pick up the dust and continue on your way.");
                inventory.addMaterialToInventory("Dust", dust);
                System.out.println("1. Continue");
                scanner.next();
                App.actionMenu();
                break;
            case 12:
                previousCase = 12;
                int dexterityCheck = random.nextInt(100) + 1;
                double damageReduction = 0;
                System.out.println("You travel through a mountain pass overlooking the badlands.");
                System.out.println("You continue walking and suddenly the ground beneath you gives way!");

                if (classType.getIronSkinUnlocked() == true) { System.out.println("You use Iron Skin to brace yourself for the fall!"); }
                if (player.getDexterity() >= dexterityCheck) { System.out.println("On your way down you manage to grab onto a few rocks and slow your fall!"); }
                System.out.println("You fall into a cave and land on your back!");
                // Damage Calc
                if (classType.getIronSkinUnlocked() == true) { damageReduction += .10; }
                if (player.getDexterity() >= dexterityCheck) { damageReduction += .15; }
                
                double damage = .50 - damageReduction;
                int damageTaken = player.getHealth() - (int) (player.getHealth() * damage);

                System.out.println("You take " + damageTaken + " damage from the fall!");
                System.out.println("Fortunately the cave is tiny and you can see the exit.");
                System.out.println("1. Leave The Cave" + "\n" + "2. Look Around");
                choice = scanner.nextInt();
                App.clearScreen();

                switch (choice) {
                    case 1:
                        System.out.println("You leave the cave and continue on your way.");
                        System.out.println("1. Continue");
                        scanner.next();
                        App.actionMenu();
                        break;
                    case 2:
                        String experience = "";
                        int exp = random.nextInt(3) + 1;
                        switch (exp) {
                            case 1:
                                experience = "everything everywhere all at once";
                                break;
                            case 2:
                                experience = "the beginning and the end";
                                break;
                            case 3:
                                experience = "a lifetime of pain and suffering";
                                break;
                        }

                        System.out.println("You explore your surroundings and find a strange looking rock.");
                        System.out.println("You reach out to touch the rock and the nanosecond you make contact with the rock\n"
                        + "you experience " + experience);
                        System.out.println("You wake up outside of the cave, you feel different...");

                        switch (exp) {
                            case 1:
                                System.out.println("You gain enough experience to level up!\n");
                                player.setExperience(player.getExperience() + player.getExperienceToLevel());
                                player.levelUp();
                                break;
                            case 2:
                                System.out.println("You gain 1 Attribute Point!");
                                player.setAttributePoints(player.getAttributePoints() + 1);
                                break;
                            case 3:
                                System.out.println("You notice the rock has cracked open and inside is an ore you've never seen before.");
                                System.out.println("You gain 1 " + " Void Ore!");
                                inventory.addMaterialToInventory("Void Ore", 1);
                                break;
                        }
                        System.out.println("1. Continue");
                        scanner.next();
                        App.actionMenu();
                        break;
                }
                break;
            case 13:
                previousCase = 13;
                int oreAmount = 0;
                System.out.println("You happen to stumble upon a mining outpost.");
                System.out.println("You approach the outpost and ask around for the foreman.");
                System.out.println("You find the foreman and ask how much it would cost to mine some ore.");
                System.out.println("Foreman: Well it depends on how much you want to mine.");
                System.out.println("Foreman: We charge 500g per ore mined.\n");
                System.out.println("Current Gold: " + player.getGold() + "g");
                System.out.println("1. Mine 1 Ore\n" + "2. Mine 5 Ore\n" + "3. Mine 10 Ore\n" + "4. Mine 25 Ore\n" + "5. Mine 50 Ore\n" + "6. Mine 100 Ore\n" + "7. Leave");
                
                choice = scanner.nextInt();
                App.clearScreen();
                switch (choice) {
                    case 1:
                        if (player.getGold() >= 500) {
                            System.out.println("You pay the foreman 500g and mine 1 ore.");
                            player.setGold(player.getGold() - 500);
                            player.setTotalGoldSpent(player.getTotalGoldSpent() + 500);
                            oreAmount = 1;
                        } else {
                            System.out.println("You don't have enough gold to mine 1 ore.");
                            scanner.next();
                            App.actionMenu();
                        }
                        break;
                    case 2:
                        if (player.getGold() >= 2500) {
                            System.out.println("You pay the foreman 2500g and mine 5 ore.");
                            player.setGold(player.getGold() - 2500);
                            player.setTotalGoldSpent(player.getTotalGoldSpent() + 2500);
                            oreAmount = 5;
                        } else {
                            System.out.println("You don't have enough gold to mine 5 ore.");
                            scanner.next();
                            App.actionMenu();
                        }
                        break;
                    case 3:
                        if (player.getGold() >= 5000) {
                            System.out.println("You pay the foreman 5000g and mine 10 ore.");
                            player.setGold(player.getGold() - 5000);
                            player.setTotalGoldSpent(player.getTotalGoldSpent() + 5000);
                            oreAmount = 10;
                        } else {
                            System.out.println("You don't have enough gold to mine 10 ore.");
                            scanner.next();
                            App.actionMenu();
                        }
                        break;
                    case 4:
                        if (player.getGold() >= 12500) {
                            System.out.println("You pay the foreman 12500g and mine 25 ore.");
                            player.setGold(player.getGold() - 12500);
                            player.setTotalGoldSpent(player.getTotalGoldSpent() + 12500);
                            oreAmount = 25;
                        } else {
                            System.out.println("You don't have enough gold to mine 25 ore.");
                            scanner.next();
                            App.actionMenu();
                        }
                        break;
                    case 5:
                        if (player.getGold() >= 25000) {
                            System.out.println("You pay the foreman 25000g and mine 50 ore.");
                            player.setGold(player.getGold() - 25000);
                            player.setTotalGoldSpent(player.getTotalGoldSpent() + 25000);
                            oreAmount = 50;
                        } else {
                            System.out.println("You don't have enough gold to mine 50 ore.");
                            scanner.next();
                            App.actionMenu();
                        }
                        break;
                    case 6:
                        if (player.getGold() >= 50000) {
                            System.out.println("You pay the foreman 50000g and mine 100 ore.");
                            player.setGold(player.getGold() - 50000);
                            player.setTotalGoldSpent(player.getTotalGoldSpent() + 50000);
                            oreAmount = 100;
                        } else {
                            System.out.println("You don't have enough gold to mine 100 ore.");
                            scanner.next();
                            App.actionMenu();
                        }
                        break;
                    case 7:
                        System.out.println("You leave the outpost and continue on your way.");
                        System.out.println("1. Continue");
                        scanner.next();
                        App.actionMenu();
                        break;
                }

                int coalAmount = 0;
                int ironAmount = 0;
                int goldAmount = 0;
                int platinumAmount = 0;
                int titaniumAmount = 0;

                for (int i = 0; i < oreAmount; i++) {
                    int ore = random.nextInt(5) + 1;
                    switch (ore) {
                        case 1:
                            inventory.addMaterialToInventory("Coal", 5);
                            coalAmount += 5;
                            break;
                        case 2:
                            inventory.addMaterialToInventory("Iron Ore", 4);
                            ironAmount += 4;
                            break;
                        case 3:
                            inventory.addMaterialToInventory("Gold Ore", 2);
                            goldAmount += 2;
                            break;
                        case 4:
                            inventory.addMaterialToInventory("Platinum Ore", 1);
                            platinumAmount++;
                            break;
                        case 5:
                            inventory.addMaterialToInventory("Titanium Ore", 1);
                            titaniumAmount++;
                            break;
                    }
                }

                System.out.println("You mine the ore and gain the following:");
                System.out.println(coalAmount + " Coal");
                System.out.println(ironAmount + " Iron Ore");
                System.out.println(goldAmount + " Gold Ore");
                System.out.println(platinumAmount + " Platinum Ore");
                System.out.println(titaniumAmount + " Titanium Ore\n");
                System.out.println("1. Continue");
                scanner.next();
                App.actionMenu();
                break;
            case 14:
                previousCase = 14;
                System.out.println("You find yourself against the edge of a great canyon.");
                System.out.println("Charging towards you is a giant bull!");
                System.out.println("1. Fight The Bull!");
                System.out.println("2. Jump!");
                choice = scanner.nextInt();
                App.clearScreen();
                
                switch (choice) {
                    case 1:
                        enemyGeneration.generateEnemy("Giant Raging Bull");
                        break;
                    case 2:
                        dexterityCheck = random.nextInt(1000) + 100;
                        if (player.getDexterity() >= dexterityCheck) {
                            System.out.println("You jump off the edge of the canyon and manage to grab onto a ledge!");
                            System.out.println("You pull yourself up and continue on your way.");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.actionMenu();
                        } else {
                            System.out.println("You jump off the edge of the canyon and fall...");
                            System.out.println("And fall...");
                            System.out.println("And fall...");
                            System.out.println("Until...");
                            System.out.println("SMACK!!!");
                            System.out.println("You hit the ground and your health is reduced to 1! There must be some benefactor watching over you.");
                            player.setHealth(1);
                            System.out.println("1. Continue");
                            scanner.next();
                            App.actionMenu();
                        }
                        break;
                }
                break;
            case 15:
                previousCase = 15;
                int dustDevil = random.nextInt(250) + 25;
                System.out.println("During your travels through the badlands you feel the winds pick up.");
                System.out.println("You look around and realize you're in the middle of a dust devil!");
                System.out.println("1. Try to escape");
                scanner.next();
                App.clearScreen();
                if (player.getStrength() + player.getResilience() >= dustDevil) {
                    System.out.println("You manage to escape the dust devil!");
                    System.out.println("1. Continue");
                    scanner.next();
                    App.actionMenu();
                } else {
                    System.out.println("You're unable to escape the dust devil!");
                    System.out.println("You take 10% of current health in damage!");
                    player.setHealth(player.getHealth() - (player.getHealth() / 100 * 10));
                    System.out.println("1. Continue");
                    scanner.next();
                    App.actionMenu();
                }
                break;
        }
        scanner.close();
    }

    public void oceanEvents(int eventNumber) {
        Scanner scanner = new Scanner(System.in);
        Random random = new Random();
        Player player = App.getPlayer();
        Inventory inventory = App.getInventory();
        Settings settings = App.getSettings();
        EnemyGeneration enemyGeneration = App.getEnemyGeneration();
        int choice = 0;

        switch (eventNumber) {
            case 11:
                previousCase = 11;
                System.out.println("As you sail through the ocean the ship begins to rock violently.");
                System.out.println("You look over the side of the ship and see a giant shadowy figure beneath you.");
                System.out.println("A Leviathan bursts out of the water and attacks your ship!");
                System.out.println("1. Fight");
                scanner.next();
                App.clearScreen();
                enemyGeneration.generateEnemy("Leviathan");
                break;
            case 12:
                previousCase = 12;
                System.out.println("As you sail through the ocean a massive whirlpool appears infront of your ship.");
                System.out.println("You try to steer away from the whirlpool but it's too late!");
                System.out.println("Your ship is sucked into the whirlpool and you're thrown overboard!");

                if (settings.getDifficulty() == 1) {
                    System.out.println("You manage to swim to shore and catch your breath.");
                    System.out.println("1. Continue");
                    scanner.next();
                } else if (settings.getDifficulty() == 2) {
                    int lostGold = player.getGold() / 2;
                    player.setGold(player.getGold() - lostGold);
                    System.out.println("You're unable to escape the whirlpool and before you know it you're sucked under.");
                    System.out.println("You wake up stranded on the shore of an island.");
                    System.out.println("You check your gear and realize half of your gold is missing, it must've fallen out while you were under.");
                    System.out.println("You lose " + lostGold + " Gold!");
                    System.out.println("1. Continue");
                    scanner.next();
                } else if (settings.getDifficulty() == 3) {
                    System.out.println("You're unable to escape the whirlpool and before you know it you're sucked under.");
                    System.out.println("You wake up stranded on the shore of an island.");
                    System.out.println("You check your gear and realize all of your gold is missing, it must've fallen out while you were under.");
                    System.out.println("You lose all of your Gold!");
                    player.setGold(0);
                    System.out.println("1. Continue");
                    scanner.next();
                }
                App.clearScreen();
                App.actionMenu();
                break;
            case 13:
                previousCase = 13;
                System.out.println("While sailing you see a vessel in the distance, heading straight for you!");
                System.out.println("As the ship gets closer you see a skull and crossbones flag waving in the wind.");
                System.out.println("1. Prepare for battle");
                System.out.println("2. Strike your colors (Surrender)");
                System.out.println("3. Try to Make a deal");
                System.out.println("4. Flee");

                choice = scanner.nextInt();
                App.clearScreen();

                switch (choice) {
                    case 1:
                        System.out.println("You prepare for battle!");
                        System.out.println("1. Continue");
                        scanner.next();
                        App.clearScreen();
                        enemyGeneration.generateEnemy("Pirate Ship");
                        break;
                    case 2:
                        int lostGold = 0;
                        double lostExp = 0;
                        switch (settings.getDifficulty()) {
                            case 1:
                                lostGold = (int) (player.getGold() / 1.5);
                                lostExp = player.getExperience() / 1.2;
                                player.setGold(player.getGold() - lostGold);
                                player.setExperience(player.getExperience() - lostExp);
                                break;
                            case 2:
                                lostGold = (int) (player.getGold() / 2);
                                lostExp = player.getExperience() / 1.8;
                                player.setGold(player.getGold() - lostGold);
                                player.setExperience(player.getExperience() - lostExp);
                                break;
                            case 3:
                                lostGold = (int) (player.getGold() / 4);
                                lostExp = player.getExperience() / 2.5;
                                player.setGold(player.getGold() - lostGold);
                                player.setExperience(player.getExperience() - lostExp);
                                break;
                        }
                        System.out.println("You strike your colors and surrender!");
                        System.out.println("The pirates board your ship and take " + lostGold);
                        System.out.println("The pirates also have some kind of magic that drains experience, you lose " + lostExp + " experience!");
                        System.out.println("1. Continue");
                        scanner.next();
                        App.clearScreen();
                        App.actionMenu();
                        break;
                    case 3:
                        System.out.println("You try to make a deal with the pirates!");
                        System.out.println("1. Offer 10% of your current gold");
                        System.out.println("2. Offer 20% of your current gold");
                        System.out.println("3. Offer 30% of your current gold");

                        choice = scanner.nextInt();
                        App.clearScreen();


                        int bribe = random.nextInt(3) + 1;

                        if (choice == bribe) {
                            System.out.println("You offer the pirates a bribe and they accept!");

                            switch (choice) {
                                case 1:
                                    System.out.println("You pay " + (player.getGold() / 100 * 10) + " Gold!");
                                    player.setGold(player.getGold() - (player.getGold() / 100 * 10));
                                    break;
                                case 2:
                                    System.out.println("You pay " + (player.getGold() / 100 * 20) + " Gold!");
                                    player.setGold(player.getGold() - (player.getGold() / 100 * 20));
                                    break;
                                case 3:
                                    System.out.println("You pay " + (player.getGold() / 100 * 30) + " Gold!");
                                    player.setGold(player.getGold() - (player.getGold() / 100 * 30));
                                    break;
                            }

                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                            break;
                        } else {
                            System.out.println("You offer the pirates a bribe and they refuse!");
                            System.out.println("You're forced to fight!");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            enemyGeneration.generateEnemy("Pirate Ship");
                            break;
                        }
                    case 4:
                        int escape = 0;

                        switch (settings.getDifficulty()) {
                            case 1:
                                escape = random.nextInt(2) + 1;
                                break;
                            case 2:
                                escape = random.nextInt(3) + 1;
                                break;
                            case 3:
                                escape = random.nextInt(4) + 1;
                                break;
                        }

                        if (escape == 1) {
                            System.out.println("You manage to escape the pirate ship!");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                            break;
                        } else {
                            System.out.println("You're unable to escape the pirate ship!");
                            System.out.println("You're forced to fight!");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            enemyGeneration.generateEnemy("Pirate Ship");
                            break;
                        }
                }
                break;
            case 14:
                previousCase = 14;
                System.out.println("You sail through the ocean until you find the perfect spot to fish!");
                System.out.println("1. Fish");
                System.out.println("2. Leave");

                choice = scanner.nextInt();
                App.clearScreen();

                switch (choice) {
                    case 1:
                        int fish = random.nextInt(25) + 1;
                        System.out.println("You fish for a while and manage to catch " + fish + " fish/items!");
                        System.out.println("You caught: ");
                        for (int i = 0; i < fish; i++) {
                            int item = random.nextInt(10) + 1;
                            switch (item) {
                                case 1:
                                    System.out.println("Trout");
                                    inventory.addMaterialToInventory("Trout", 1);
                                    break;
                                case 2:
                                    System.out.println("Bass");
                                    inventory.addMaterialToInventory("Bass", 1);
                                    break;
                                case 3:
                                    System.out.println("Cod");
                                    inventory.addMaterialToInventory("Cod", 1);
                                    break;
                                case 4:
                                    System.out.println("Flounder");
                                    inventory.addMaterialToInventory("Flounder", 1);
                                    break;
                                case 5:
                                    System.out.println("Pearl");
                                    inventory.addMaterialToInventory("Pearl", 1);
                                    break;
                                case 6:
                                    System.out.println("Old Boot");
                                    inventory.addMaterialToInventory("Old Boot", 1);
                                    break;
                                case 7:
                                    int gold = random.nextInt(1000) + 1;
                                    System.out.println(gold + " Gold");
                                    break;
                                case 8:
                                    Weapon weapon = App.getWeapon();
                                    Generation.createWeapon(false, false);
                                    try {
                                        int index = inventory.getGear().length - 1;
                                        weapon = (Weapon) inventory.getGear()[index];
                                        System.out.println(weapon.getName());
                                        if (weapon.getName().equals("Standard")) {
                                            System.out.println("A weapon was caught but it was sold via the Loot Filter!");
                                        }
                                    } catch (Exception e) {
                                        System.out.println("A weapon was caught but it was sold via the Loot Filter!");
                                    }
                                    break;
                                case 9:
                                    System.out.println("Swordfish");
                                    inventory.addMaterialToInventory("Swordfish", 1);
                                    break;
                                case 10:
                                    System.out.println("Fish Scales");
                                    inventory.addMaterialToInventory("Fish Scales", 1);
                                    break;
                            }
                        }
                        System.out.println("\n1. Continue");
                        scanner.next();
                        App.clearScreen();
                        App.actionMenu();
                    case 2:
                        App.actionMenu();
                        break;
                }
                break;
            case 15:
                previousCase = 15;
                System.out.println("Crow's Nest: Land Ahoy!");
                System.out.println("You dock your ship at the new Region.");
                System.out.println("1. Continue");
                scanner.next();
                changeLocation();
                break;
        }
        scanner.close();
    }

    public void volcanoEvents(int eventNumber) {
        Scanner scanner = new Scanner(System.in);
        Random random = new Random();
        Player player = App.getPlayer();
        Variables variables = App.getVariables();
        Inventory inventory = App.getInventory();
        Settings settings = App.getSettings();
        EnemyGeneration enemyGeneration = App.getEnemyGeneration();
        Bots npc = new Bots();
        int choice = 0;

        switch (eventNumber) {
            case 11:
                previousCase = 11;
                int safety = random.nextInt(3) + 1;
                System.out.println("You travel through the volcano and start to feel the ground shake.");
                System.out.println("You look around while trying to stay upright, suddenly you hear a massive explosion!");
                System.out.println("You look up and see the volcano begining to erupt, lava starts to flow down and meteors begin to fall from the sky!");
                System.out.println("1. Find Cover");
                System.out.println("2. Find Higher Ground");
                System.out.println("3. Run for the beach");

                choice = scanner.nextInt();
                App.clearScreen();

                if (choice == safety) {
                    System.out.println("You manage to find safety!");
                    System.out.println("After a few hours the volcano stops erupting and you gather some Obsidian.");
                    System.out.println("You gain 5 Obsidian!");
                    inventory.addMaterialToInventory("Obsidian", 5);
                    System.out.println("1. Continue");
                    scanner.next();
                    App.clearScreen();
                    App.actionMenu();
                    break;
                } else {
                    System.out.println("You're unable to find safety!");

                    switch (settings.getDifficulty()) {
                        case 1:
                            int damage = player.getHealth() / 10;
                            player.setHealth(player.getHealth() - damage);
                            System.out.println("You take " + damage + " damage!");
                            break;
                        case 2:
                            damage = player.getHealth() * 6 / 10;
                            player.setHealth(player.getHealth() - damage);
                            System.out.println("You take " + damage + " damage!");
                            break;
                        case 3:
                            damage = player.getHealth() * 95 / 100;
                            player.setHealth(player.getHealth() - damage);
                            System.out.println("You take " + damage + " damage!");
                            break;
                    }

                    System.out.println("1. Continue");
                    scanner.next();
                    App.clearScreen();
                    App.actionMenu();
                    break;
                }
            case 12:
                previousCase = 12;
                System.out.println("You travel through the volcano and see a bridge coming up ahead.");
                System.out.println("As you get closer you notice the bridge is old and likely unstable.");
                System.out.println("You check your map and realize the bridge is the only way to get to the other side.");
                System.out.println("1. Cross the bridge");
                System.out.println("2. Find another way");

                choice = scanner.nextInt();
                App.clearScreen();

                if (choice == 1) {
                    int dexterityCheck = random.nextInt(100) + 1;
                    switch (settings.getDifficulty()) {
                        case 1:
                            if (player.getDexterity() >= dexterityCheck) {
                                System.out.println("You manage to cross the bridge without any issues!");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                                break;
                            } else {
                                System.out.println("The bridge collapses and you fall into the lava!");
                                System.out.println("Somehow you manage to survive the fall and crawl out of the lava.");
                                System.out.println("You have 1 health!");
                                player.setHealth(1);
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                                break;
                            }
                        case 2:
                            dexterityCheck = dexterityCheck * 2;
                            if (player.getDexterity() >= dexterityCheck) {
                                System.out.println("You manage to cross the bridge without any issues!");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                                break;
                            } else {
                                System.out.println("The bridge collapses and you fall into the lava!");
                                System.out.println("Somehow you manage to survive the fall and crawl out of the lava.");
                                System.out.println("You have 1 health!");
                                player.setHealth(1);
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                                break;
                            }
                        case 3:
                            dexterityCheck = dexterityCheck * 4;
                            if (player.getDexterity() >= dexterityCheck) {
                                System.out.println("You manage to cross the bridge without any issues!");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                                break;
                            } else {
                                System.out.println("The bridge collapses and you fall into the lava!");
                                System.out.println("Somehow you manage to survive the fall and crawl out of the lava.");
                                System.out.println("You have 1 health!");
                                player.setHealth(1);
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                                break;
                            }
                    }
                } else {
                    System.out.println("You decide to find another way around.");
                    System.out.println("After literal days of searching you finally find another way around.");
                    System.out.println("You lose all your stamina due to exhaustion!");
                    player.setStamina(0);
                    System.out.println("1. Continue");
                    scanner.next();
                    App.clearScreen();
                    App.actionMenu();
                    break;
                }
            case 13:
                previousCase = 13;
                System.out.println("While traveling a demon flies down and lands infront of you.");
                System.out.println("Demon: Leave this place or die mortal!");
                System.out.println("1. Leave");
                System.out.println("2. Fight!");

                choice = scanner.nextInt();
                App.clearScreen();

                if (choice == 1) {
                    System.out.println("You leave the volcano and continue on your way.");
                    changeLocation();
                    break;
                } else {
                    enemyGeneration.generateEnemy("Infernal Fire Demon");
                    break;
                }
            case 14:
                previousCase = 14;
                System.out.println("You climb the volcano and reach the top.");
                System.out.println("You stare out upon the massive lava pool");
                System.out.println("1. Continue");
                if (variables.getStepOne() == true && variables.getStepTwo() == false) {
                    System.out.println("2. Throw the Soul of Sauron into the lava");
                }

                choice = scanner.nextInt();
                App.clearScreen();

                if (choice == 1) {
                    App.actionMenu();
                    break;
                } else if (choice == 2) {
                    if (variables.getStepOne() == true && variables.getStepTwo() == false) {
                        System.out.println("You throw the Soul of Sauron into the lava and watch as it sinks into the lava.");
                        System.out.println("The lava begins to bubble and the Soul of Sauron begins to rise from the lava!");
                        System.out.println("The ring is glowing as it floats towards you");
                        System.out.println("You reach out to grab the ring and as soon as you touch it you feel a surge of power!");
                        System.out.println("Upon further inspection of the ring you notice theres a new inscription on the inside of the ring.");
                        System.out.println("'Burn the world in my wake'");
                        System.out.println("You've aquired The Burning Ring!");
                        System.out.println("You should see what a blacksmith can do with this ring.");
                        inventory.removeMaterialFromInventory("Soul of Sauron", 1);
                        Generation.createRing("The Burning Ring", false);
                        System.out.println("1. Continue");
                        scanner.next();
                        App.clearScreen();
                        App.actionMenu();
                        break;
                    }
                }
                break;
            case 15:
                previousCase = 15;
                npc.zolgadiyun();
                break;
        }
        scanner.close();
    }

    public void mountainEvents(int eventNumber) {
        Scanner scanner = new Scanner(System.in);
        Random random = new Random();
        Player player = App.getPlayer();
        Variables variables = App.getVariables();
        Inventory inventory = App.getInventory();
        ClassType classType = App.getClassType();
        EnemyGeneration enemyGeneration = App.getEnemyGeneration();
        Bots npc = new Bots();
        int choice = 0;

        switch (eventNumber) {
            case 11:
                previousCase = 11;
                int oreAmount = 0;
                System.out.println("You travel through the mountains and come across a cave entrance.");
                System.out.println("You enter the cave and find a grandiose mining operation.");
                System.out.println("You approach the dwarven miners and ask arouind for the foreman.");
                System.out.println("After a few grunts and threats you're pointed in the direction of the foreman.");
                System.out.println("You reach the foreman and ask how much it would cost to mine some ore.");
                System.out.println("Foreman: Well be it that our mine is the only one in the world with raw mithril, we charge 2500g per ore mined.\n");
                System.out.println("Current Gold: " + player.getGold() + "g");
                System.out.println("1. Mine 1 Ore\n" + "2. Mine 5 Ore\n" + "3. Mine 10 Ore\n" + "4. Mine 25 Ore\n" + "5. Mine 50 Ore\n" + "6. Mine 100 Ore\n" + "7. Leave");
                
                choice = scanner.nextInt();
                App.clearScreen();
                switch (choice) {
                    case 1:
                        if (player.getGold() >= 2500) {
                            System.out.println("You pay the foreman 2500g and mine 1 ore.");
                            player.setGold(player.getGold() - 2500);
                            player.setTotalGoldSpent(player.getTotalGoldSpent() + 2500);
                            oreAmount = 1;
                        } else {
                            System.out.println("You don't have enough gold to mine 1 ore.");
                            scanner.next();
                            App.actionMenu();
                        }
                        break;
                    case 2:
                        if (player.getGold() >= 12500) {
                            System.out.println("You pay the foreman 12500g and mine 5 ore.");
                            player.setGold(player.getGold() - 12500);
                            player.setTotalGoldSpent(player.getTotalGoldSpent() + 12500);
                            oreAmount = 5;
                        } else {
                            System.out.println("You don't have enough gold to mine 5 ore.");
                            scanner.next();
                            App.actionMenu();
                        }
                        break;
                    case 3:
                        if (player.getGold() >= 25000) {
                            System.out.println("You pay the foreman 25000g and mine 10 ore.");
                            player.setGold(player.getGold() - 25000);
                            player.setTotalGoldSpent(player.getTotalGoldSpent() + 25000);
                            oreAmount = 10;
                        } else {
                            System.out.println("You don't have enough gold to mine 10 ore.");
                            scanner.next();
                            App.actionMenu();
                        }
                        break;
                    case 4:
                        if (player.getGold() >= 62500) {
                            System.out.println("You pay the foreman 62500g and mine 25 ore.");
                            player.setGold(player.getGold() - 62500);
                            player.setTotalGoldSpent(player.getTotalGoldSpent() + 62500);
                            oreAmount = 25;
                        } else {
                            System.out.println("You don't have enough gold to mine 25 ore.");
                            scanner.next();
                            App.actionMenu();
                        }
                        break;
                    case 5:
                        if (player.getGold() >= 12500) {
                            System.out.println("You pay the foreman 125000g and mine 50 ore.");
                            player.setGold(player.getGold() - 12500);
                            player.setTotalGoldSpent(player.getTotalGoldSpent() + 12500);
                            oreAmount = 50;
                        } else {
                            System.out.println("You don't have enough gold to mine 50 ore.");
                            scanner.next();
                            App.actionMenu();
                        }
                        break;
                    case 6:
                        if (player.getGold() >= 250000) {
                            System.out.println("You pay the foreman 250000g and mine 100 ore.");
                            player.setGold(player.getGold() - 250000);
                            player.setTotalGoldSpent(player.getTotalGoldSpent() + 250000);
                            oreAmount = 100;
                        } else {
                            System.out.println("You don't have enough gold to mine 100 ore.");
                            scanner.next();
                            App.actionMenu();
                        }
                        break;
                    case 7:
                        System.out.println("You leave the outpost and continue on your way.");
                        System.out.println("1. Continue");
                        scanner.next();
                        App.actionMenu();
                        break;
                }

                int coalAmount = 0;
                int ironAmount = 0;
                int goldAmount = 0;
                int platinumAmount = 0;
                int titaniumAmount = 0;
                int mithrilAmount = 0;

                for (int i = 0; i < oreAmount; i++) {
                    int ore = random.nextInt(6) + 1;
                    switch (ore) {
                        case 1:
                            inventory.addMaterialToInventory("Coal", 25);
                            coalAmount += 25;
                            break;
                        case 2:
                            inventory.addMaterialToInventory("Iron Ore", 15);
                            ironAmount += 15;
                            break;
                        case 3:
                            inventory.addMaterialToInventory("Gold Ore", 10);
                            goldAmount += 10;
                            break;
                        case 4:
                            inventory.addMaterialToInventory("Platinum Ore", 6);
                            platinumAmount += 6;
                            break;
                        case 5:
                            inventory.addMaterialToInventory("Titanium Ore", 4);
                            titaniumAmount += 4;
                            break;
                        case 6:
                            inventory.addMaterialToInventory("Mithril Ore", 1);
                            mithrilAmount++;
                            break;
                    }
                }

                System.out.println("You mine the ore and gain the following:");
                System.out.println(coalAmount + " Coal");
                System.out.println(ironAmount + " Iron Ore");
                System.out.println(goldAmount + " Gold Ore");
                System.out.println(platinumAmount + " Platinum Ore");
                System.out.println(titaniumAmount + " Titanium Ore");
                System.out.println(mithrilAmount + " Mithril Ore\n");
                System.out.println("1. Continue");
                scanner.next();
                App.actionMenu();
                break;
            case 12:
                previousCase = 12;
                if (variables.getAmelia() == true || variables.getTsungBlessing() == true) {
                   npc.templeOfTheGods();
                   break;
                } else {
                    System.out.println("You travel through a snowy pass and the ground begins to shake.");
                    System.out.println("You start to hear a loud rushing sound...");
                    System.out.println("You look up and see a massive avalanche heading straight for you!");
                    System.out.println("1. Find Cover");
                    System.out.println("2. Try to outrun it");
                    System.out.println("3. Go with the flow");
                    choice = scanner.nextInt();
                    App.clearScreen();

                    int safety = 0;
                    switch (App.getSettings().getDifficulty()) {
                        case 1:
                            safety = random.nextInt(2) + 1;
                            break;
                        case 2:
                            safety = random.nextInt(3) + 1;
                            break;
                        case 3:
                            safety = random.nextInt(4) + 1;
                            break;
                    }

                    switch (choice) {
                        case 1:
                            if (choice == safety) {
                                System.out.println("You manage to find safety!");
                                System.out.println("After a few hours the avalanche stops and you gather some Ice.");
                                System.out.println("You gain 10 Ice!");
                                inventory.addMaterialToInventory("Ice", 10);
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                                break;
                            } else {
                                System.out.println("You're unable to find safety and are swept away by the avalanche!");
                                System.out.println("Your health has been halved!");
                                player.setHealth(player.getHealth() / 2);
                                System.out.println("You eventually end up at the bottom of the mountain.");
                                System.out.println("After digging yourself out of the snow you're greeted by a Yeti!");
                                System.out.println("1. Defend yourself!");
                                scanner.next();
                                App.clearScreen();
                                enemyGeneration.generateEnemy("Yeti");
                                break;
                            }
                        case 2:
                            int dexterityCheck = random.nextInt(250) + 1;
                            switch (App.getSettings().getDifficulty()) {
                                case 1:
                                    dexterityCheck = dexterityCheck * 2;
                                    break;
                                case 2:
                                    dexterityCheck = dexterityCheck * 4;
                                    break;
                                case 3:
                                    dexterityCheck = dexterityCheck * 6;
                                    break;
                            }

                            if (player.getDexterity() >= dexterityCheck) {
                                System.out.println("You manage to outrun the avalanche!");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                                break;
                            } else {
                                System.out.println("You're unable to outrun the avalanche and are swept away!");
                                System.out.println("Your health has been halved!");
                                player.setHealth(player.getHealth() / 2);
                                System.out.println("You eventually end up at the bottom of the mountain.");
                                System.out.println("After digging yourself out of the snow you're greeted by a Yeti!");
                                System.out.println("1. Defend yourself!");
                                scanner.next();
                                App.clearScreen();
                                enemyGeneration.generateEnemy("Yeti");
                                break;
                            }
                        case 3:
                            System.out.println("You are swept away by the avalanche!");
                            System.out.println("Your health has been halved!");
                            player.setHealth(player.getHealth() / 2);
                            System.out.println("You eventually end up at the bottom of the mountain.");
                            System.out.println("After digging yourself out of the snow you're greeted by a Yeti!");
                            System.out.println("1. Defend yourself!");
                            scanner.next();
                            App.clearScreen();
                            enemyGeneration.generateEnemy("Yeti");
                            break;
                    }
                    break;
                }
            case 13:
                previousCase = 13;
                if (variables.getFrozenElfStatus().equals("Default")) {
                    System.out.println("During your hike through the mountains you notice a particularly large chunk of ice.");
                    System.out.println("You approach the ice and see a frozen figure inside.");
                    System.out.println("You break a piece of the ice and realize it's a frozen elf!");
                    System.out.println("You decide to not break the ice since you don't want to risk killing the elf.");
                    System.out.println("You need to find a way to melt the ice.\n");

                    System.out.println("Current Wood: " + inventory.getMaterialAmount("Wood"));
                    System.out.println("Current Leather: " + inventory.getMaterialAmount("Leather"));
                    System.out.println("Current Coal: " + inventory.getMaterialAmount("Coal"));

                    System.out.println("\n1. Make a fire [Requires 10 Wood, 2 Leather & 1 Coal]");
                    System.out.println("2. Break the ice and risk killing the elf");
                    System.out.println("3. Leave the elf");

                    if (classType.getFireballUnlocked() == true) {
                        System.out.println("4. Use Fireball");
                    }

                    choice = scanner.nextInt();
                    App.clearScreen();

                    switch (choice) {
                        case 1:
                            if (inventory.getMaterialAmount("Wood") >= 10 && inventory.getMaterialAmount("Leather") >= 2 && inventory.getMaterialAmount("Coal") >= 1) {
                                variables.setFrozenElfStatus("Saved");
                                inventory.removeMaterialFromInventory("Wood", 10);
                                inventory.removeMaterialFromInventory("Leather", 2);
                                inventory.removeMaterialFromInventory("Coal", 1);
                                System.out.println("You make a fire and melt the ice!");
                                System.out.println("You successfully free the elf, wrap her in your cloak and carry her to town.");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                npc.frozenElf();
                                break;
                            } else {
                                System.out.println("You don't have enough materials to make a fire!");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                                break;
                            }
                        case 2:
                            int risk = random.nextInt(4) + 1;
                            if (risk == 1) {
                                variables.setFrozenElfStatus("Dead");
                                System.out.println("As your breaking the ice it suddenly shatters into a million pieces!");
                                System.out.println("The elf is dead...");
                                System.out.println("1. Bury the elf");
                                System.out.println("2. Leave the elf");

                                scanner.nextInt();
                                App.clearScreen();

                                if (choice == 1) {
                                    variables.setFrozenElfStatus("Buried");
                                    System.out.println("You bury the elf and continue on your way.");
                                    System.out.println("1. Continue");
                                    scanner.next();
                                    App.clearScreen();
                                    App.actionMenu();
                                    break;
                                } else {
                                    variables.setFrozenElfStatus("Dead");
                                    System.out.println("You leave the elf and continue on your way.");
                                    System.out.println("1. Continue");
                                    scanner.next();
                                    App.clearScreen();
                                    App.actionMenu();
                                    break;
                                }
                            } else {
                                variables.setFrozenElfStatus("Saved");
                                System.out.println("You meticulously break the ice and manage to free the elf!");
                                System.out.println("You wrap the elf in your cloak and carry her to town.");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                npc.frozenElf();
                                break;
                            }
                        case 3:
                            System.out.println("You leave the elf and continue on your way.");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                            break;
                        case 4:
                            if (classType.getFireballUnlocked() == true) {
                                if (choice == 4) {
                                    variables.setFrozenElfStatus("Saved");
                                    System.out.println("You use Fireball to melt the ice!");
                                    System.out.println("The elf is unharmed and you wrap her in your cloak and carry her to town.");
                                    scanner.next();
                                    npc.frozenElf();
                                    break;
                                }
                            }
                    }
                } else if (variables.getFrozenElfStatus().equals("Saved")) {
                    System.out.println("You travel through the mountains and see the remains of the ice you broke earlier.");
                    System.out.println("You gather some of the ice and put it in your bag.");
                    System.out.println("You gain 10 Ice!");
                    inventory.addMaterialToInventory("Ice", 10);
                    System.out.println("1. Continue");
                    scanner.next();
                    App.clearScreen();
                    App.actionMenu();
                    break;
                } else if (variables.getFrozenElfStatus().equals("Dead")) {
                    variables.setFrozenElfStatus("Buried");
                    System.out.println("You travel through the mountains and see the elf you tried to save earlier.");
                    System.out.println("Her body has been frozen solid and is covered in ice.");
                    System.out.println("You feel ashamed and decide to give her a proper burial.");
                    System.out.println("1. Continue");
                    scanner.next();
                    App.clearScreen();
                    App.actionMenu();
                    break;
                } else if (variables.getFrozenElfStatus().equals("Buried")) {
                    System.out.println("You travel through the mountains and see the grave of the elf you tried to save earlier.");
                    System.out.println("You pay yours respects and continue on your way.");
                    scanner.next();
                    App.clearScreen();
                    App.actionMenu();
                    break;
                }
                break;
            case 14:
                previousCase = 14;
                if (variables.getDwarvenForge() == false) {
                    npc.dwarvenForge(true);
                } else {
                    int mithril = random.nextInt(5) + 1;
                    System.out.println("You travel through the mountains and see the Dwarven Forge you visited earlier.");
                    System.out.println("Hasun isn't here anymore so you decide to see if you can find anything useful.");
                    System.out.println("You find " + mithril + " Mithril Ore!");
                    inventory.addMaterialToInventory("Mithril Ore", mithril);
                    System.out.println("1. Continue");
                    scanner.next();
                    App.clearScreen();
                    App.actionMenu();
                    break;
                }
                break;
            case 15:
                previousCase = 15;
                System.out.println("During your travel through the mountains, a huge snow storm hits.");
                System.out.println("You try to find shelter but you're unable to.");
                System.out.println("Suddenly you hear a loud roar from above!");
                System.out.println("You look up and see a Dragon heading straight for you!");
                System.out.println("1. prepare for battle!");
                scanner.next();
                enemyGeneration.generateEnemy("Vadhulath, Monarch of the Frozen Skies");
                break;
        }
        scanner.close();
    }

    public void desertEvents(int eventNumber) {
        Scanner scanner = new Scanner(System.in);
        Random random = new Random();
        Player player = App.getPlayer();
        Inventory inventory = App.getInventory();
        EnemyGeneration enemyGeneration = App.getEnemyGeneration();
        Bots npc = new Bots();
        int choice = 0;

        switch (eventNumber) {
            case 11:
                previousCase = 11;
                npc.pyramid();
                break;
            case 12:
                previousCase = 12;
                System.out.println("You travel through the desert and encounter a Mummy!?");
                System.out.println("1. Fight!");
                scanner.next();
                App.clearScreen();
                enemyGeneration.generateEnemy("Sand Mummy");
                break;
            case 13:
                previousCase = 13;
                System.out.println("You travel through the desert, the sun is beating down on you and you're starting to get dehydrated.");
                System.out.println("You look around and see a small oasis in the distance.");
                System.out.println("You make your way to the oasis and see a small pond of water.");
                System.out.println("The closer you get the further away the oasis seems to be.");
                System.out.println("You realize you're starting to hallucinate!");
                System.out.println("You look out and see 3 Oases in the distance.\n");
                System.out.println("1. Go to the Oasis on the left");   
                System.out.println("2. Go to the Oasis in the middle");
                System.out.println("3. Go to the Oasis on the right");

                choice = scanner.nextInt();
                App.clearScreen();

                int real = random.nextInt(3) + 1;

                if (choice == real) {
                    System.out.println("You walk towards the Oasis and it turns out to be real!");
                    System.out.println("You drink some water and feel refreshed!");
                    System.out.println("You gain 10 Stamina!");
                    player.setStamina(player.getStamina() + 10);
                    if (player.getStamina() > player.getMaxStamina()) {
                        player.setStamina(player.getMaxStamina());
                    }
                    System.out.println("You also gain 2 Attribute Points!");
                    player.setAttributePoints(player.getAttributePoints() + 2);
                    System.out.println("1. Continue");
                    scanner.next();
                    App.clearScreen();
                    App.actionMenu();
                    break;
                } else {
                    System.out.println("You walk towards the Oasis and realize it's a mirage!");
                    System.out.println("You're vision starts to fade and you collapse.");
                    System.out.println("You wake up in the middle of the desert with a water skin next to you.");
                    System.out.println("You relaize you were saved by someone, but they stole half your gold!");

                    int gold = player.getGold() / 2;
                    player.setGold(gold);

                    System.out.println("You lose " + gold + " gold!");
                    System.out.println("1. Continue");
                    scanner.next();
                    App.clearScreen();
                    App.actionMenu();
                    break;
                }
            case 14:
                previousCase = 14;
                System.out.println("You travel through the desert and suddenly it gets harder to move.");
                System.out.println("You look down and see the sand is turning into quicksand!");

                System.out.println("1. Create a rope anchor [1 Iron Ingot & 2 Leather]");
                System.out.println("2. Try and escape");

                choice = scanner.nextInt();
                App.clearScreen();

                switch (choice) {
                    case 1:
                        if (inventory.getMaterialAmount("Iron Ingot") >= 1 && inventory.getMaterialAmount("Leather") >= 2) {
                            inventory.removeMaterialFromInventory("Iron Ingot", 1);
                            inventory.removeMaterialFromInventory("Leather", 2);
                            System.out.println("You create a rope anchor and throw it to the nearest rock!");
                            System.out.println("You manage to pull yourself out of the quicksand!");

                            System.out.println("You gain 2 Attribute Points!");
                            player.setAttributePoints(player.getAttributePoints() + 2);


                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                            break;
                        } else {
                            System.out.println("You don't have enough materials to create a rope anchor!");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                        }
                    case 2:
                        int strengthCheck = random.nextInt(100) + 1;
                        switch (App.getSettings().getDifficulty()) {
                            case 1:
                                strengthCheck = strengthCheck * 2;
                                break;
                            case 2:
                                strengthCheck = strengthCheck * 4;
                                break;
                            case 3:
                                strengthCheck = strengthCheck * 6;
                                break;
                        }

                        System.out.println("You try to pull yourself out of the quicksand!");

                        if (player.getStrength() >= strengthCheck) {
                            System.out.println("You manage to pull yourself out of the quicksand!");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                            break;
                        } else {
                            System.out.println("You're unable to pull yourself out of the quicksand!");
                            System.out.println("You're forced to fight??");
                            System.out.println("1. Fisght!?");
                            scanner.next();
                            App.clearScreen();
                            enemyGeneration.generateEnemy("Quicksand");
                            break;
                        }
                }
            case 15:
                previousCase = 15;
                System.out.println("You travel through the desert and suddenly the ground begins to shake.");
                System.out.println("You look around and see something huge moving around under the sand.");
                System.out.println("You try to run but you're too slow and a giant death worm bursts out of the sand!");
                System.out.println("1. Fight!");
                scanner.next();
                App.clearScreen();
                enemyGeneration.generateEnemy("Colossal Death Worm");
                break;
        }
        scanner.close();
    }

    public void warzoneEvents(int eventNumber) {
        Scanner scanner = new Scanner(System.in);
        Random random = new Random();
        Player player = App.getPlayer();
        Variables variables = App.getVariables();
        Inventory inventory = App.getInventory();
        EnemyGeneration enemyGeneration = App.getEnemyGeneration();
        Armor armor = App.getArmor();
        int choice = 0;

        switch (eventNumber) {
            case 11:
                previousCase = 11;
                int enemy = random.nextInt(2) + 1;
                String enemyName = (enemy == 1) ? "Atlas Soldier" : "Lerrelan Soldier";
                enemyGeneration.generateEnemy(enemyName);
                break;
            case 12:
                previousCase = 12;
                enemy = random.nextInt(2) + 1;
                enemyName = (enemy == 1) ? "Atlas Lieutenant" : "Lerrelan Lieutenant";
                enemyGeneration.generateEnemy(enemyName);
            case 13:
                previousCase = 13;
                enemy = random.nextInt(2) + 1;
                enemyName = (enemy == 1) ? "Atlas General" : "Lerrelan General";
                enemyGeneration.generateEnemy(enemyName);
                break;
            case 14:
                previousCase = 14;
                enemy = random.nextInt(2) + 1;
                enemyName = (enemy == 1) ? "Reginald, Leader of Atlas" : "Dallin, Leader of Lerrelan";
                enemyGeneration.generateEnemy(enemyName);
                break;
            case 15:
                previousCase = 15;
                System.out.println("You make your way through the battlefield and come across a merchant.");
                System.out.println("Wartime Merchant: Hello hello, I trade gear for Patches.");
                System.out.println("1. Trade");
                System.out.println("2. Leave");

                choice = scanner.nextInt();
                App.clearScreen();

                if (choice == 1) {
                    System.out.println("Wartime Merchant: Here are my deals, what would you like to trade");
                    System.out.println("Current Patches: " + inventory.getMaterialAmount("Patches") + "x\n");
                    System.out.println("0. Leave");
                    System.out.println("1. 10x Patches for 10x Wood");
                    System.out.println("2. 10x Patches for 100x Coal");
                    System.out.println("3. 50x Patches for 1x Demon Heart");
                    System.out.println("4. 100x Patches for 1x Relic of The Old World");
                    System.out.println("5. 100x Patches for 100,000 Gold");
                    System.out.println("6. 150x Patches for 1x Pure Arcenergy");
                    System.out.println("7. 200x Patches for 1x Crow's Feather");
                    System.out.println("8. 500x Patches for Atlas Armor");
                    System.out.println("9. 500x Patches for Elven Robes");
                    System.out.print("Enter your choice: ");
                } else if (choice == 2) {
                    App.actionMenu();
                }

                choice = scanner.nextInt();
                App.clearScreen();

                switch (choice) {
                    case 0:
                        App.actionMenu();
                        break;
                    case 1:
                        if (inventory.getMaterialAmount("Patches") >= 10) {
                            inventory.removeMaterialFromInventory("Patches", 10);
                            inventory.addMaterialToInventory("Wood", 10);
                            System.out.println("You trade 10x Patches for 10x Wood!");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                            break;
                        } else {
                            System.out.println("You don't have enough Patches!");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                            break;
                        }
                    case 2:
                        if (inventory.getMaterialAmount("Patches") >= 10) {
                            inventory.removeMaterialFromInventory("Patches", 10);
                            inventory.addMaterialToInventory("Coal", 100);
                            System.out.println("You trade 10x Patches for 100x Coal!");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                            break;
                        } else {
                            System.out.println("You don't have enough Patches!");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                            break;
                        }
                    case 3:
                        if (inventory.getMaterialAmount("Patches") >= 50) {
                            inventory.removeMaterialFromInventory("Patches", 50);
                            inventory.addMaterialToInventory("Demon Heart", 1);
                            System.out.println("You trade 50x Patches for 1x Demon Heart!");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                            break;
                        } else {
                            System.out.println("You don't have enough Patches!");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                            break;
                        }
                    case 4:
                        if (inventory.getMaterialAmount("Patches") >= 100) {
                            inventory.removeMaterialFromInventory("Patches", 100);
                            inventory.addMaterialToInventory("Relic of The Old World", 1);
                            System.out.println("You trade 100x Patches for 1x Relic of The Old World!");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                            break;
                        } else {
                            System.out.println("You don't have enough Patches!");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                            break;
                        }
                    case 5:
                        if (inventory.getMaterialAmount("Patches") >= 100) {
                            inventory.removeMaterialFromInventory("Patches", 100);
                            player.setGold(player.getGold() + 100000);
                            System.out.println("You trade 100x Patches for 100,000 Gold!");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                            break;
                        } else {
                            System.out.println("You don't have enough Patches!");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                            break;
                        }
                    case 6:
                        if (inventory.getMaterialAmount("Patches") >= 150) {
                            inventory.removeMaterialFromInventory("Patches", 150);
                            inventory.addMaterialToInventory("Pure Arcenergy", 1);
                            System.out.println("You trade 150x Patches for 1x Pure Arcenergy!");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                            break;
                        } else {
                            System.out.println("You don't have enough Patches!");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                            break;
                        }
                    case 7:
                        if (inventory.getMaterialAmount("Patches") >= 200) {
                            inventory.removeMaterialFromInventory("Patches", 200);
                            inventory.addMaterialToInventory("Crow's Feather", 1);
                            System.out.println("You trade 200x Patches for 1x Crow's Feather!");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                            break;
                        } else {
                            System.out.println("You don't have enough Patches!");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                            break;
                        }
                    case 8:
                        if (variables.getArtifacts() == true) {
                            if (inventory.getMaterialAmount("Patches") >= 500) {
                                inventory.removeMaterialFromInventory("Patches", 500);
                                armor = new Armor("Atlas Armor", player.getLevel(), 500000, true, false);
                                Generation.filterLoot(armor);                            
                                System.out.println("You trade 500x Patches for Atlas Armor!");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                                break;
                            } else {
                                System.out.println("You don't have enough Patches!");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                                break;
                            } 
                        } else {
                            System.out.println("You must be level 30+ to buy this!");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                            break;
                        }
                    case 9:
                        if (variables.getArtifacts() == true) {
                            if (inventory.getMaterialAmount("Patches") >= 500) {
                                inventory.removeMaterialFromInventory("Patches", 500);
                                armor = new Armor("Elven Robes", player.getLevel(), 500000, true, false);
                                Generation.filterLoot(armor);                            
                                System.out.println("You trade 500x Patches for Elven Robes!");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                                break;
                            } else {
                                System.out.println("You don't have enough Patches!");
                                System.out.println("1. Continue");
                                scanner.next();
                                App.clearScreen();
                                App.actionMenu();
                                break;
                            } 
                        } else {
                            System.out.println("You must be level 30+ to buy this!");
                            System.out.println("1. Continue");
                            scanner.next();
                            App.clearScreen();
                            App.actionMenu();
                            break;
                        }
                }
                break;
        }
        scanner.close();
    }

    public void npcEvents(int eventNumber) {
        Bots npc = new Bots();
        switch (eventNumber) {
            case 1:
            npc.tsung();
            break;
        }
        App.clearScreen();
        App.actionMenu();
    }

}


