Feature: Training pressure curve
  The timed math loop is the climb engine of MathsMine3.
  Web (`lib/training-game.js`) and Android (`TrainingRules`) must keep
  the same bands; this file is the CI-readable spec.

  Scenario Outline: difficulty band
    Given wallet level <level>
    Then difficulty is <diff>

    Examples:
      | level | diff |
      | 0     | 1    |
      | 7     | 1    |
      | 8     | 2    |
      | 19    | 2    |
      | 20    | 3    |
      | 39    | 3    |
      | 40    | 4    |
      | 69    | 4    |
      | 70    | 5    |
      | 100   | 5    |

  Scenario Outline: fail penalty
    Given wallet level <level>
    Then fail penalty is <penalty>

    Examples:
      | level | penalty |
      | 0     | 1       |
      | 14    | 1       |
      | 15    | 2       |
      | 39    | 2       |
      | 40    | 3       |
      | 69    | 3       |
      | 70    | 5       |
      | 100   | 5       |

  Scenario Outline: success delta
    Given wallet level <level>
    Then success delta is <delta>

    Examples:
      | level | delta |
      | 0     | 1     |
      | 79    | 1     |
      | 80    | 2     |
      | 100   | 2     |

  Scenario Outline: time limit floor
    Given wallet level <level>
    Then time limit is <ms> ms

    Examples:
      | level | ms   |
      | 0     | 6000 |
      | 81    | 1545 |
      | 82    | 1500 |
      | 100   | 1500 |
