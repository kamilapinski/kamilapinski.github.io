W pliku `ciag.txt` znajduje się ciąg liczb, które są oddzielone spacjami.

### Zadanie 1

Wyznacz i wypisz wszystkie możliwe wartości elementów w ciągu.

### Zadanie 2

Wyznacz i wypisz liczbę elementów tego ciągu.

### Zadanie 3

Bezpiecznym dystansem w ciągu definiujemy odstęp pomiędzy liczbami o tej samej wartości, np. w ciągu:

```
2 8 7 2 5 8 9 9 0
```

* Bezpiecznym dystansem pomiędzy liczbami o wartości `2` na pozycjach `0` i `3` jest `2`.
* Bezpiecznym dystansem pomiędzy liczbami o wartości `8` na pozycjach `1` i `5` jest `3`.

Innymi słowy liczymy to tak `d(a1, a2) = abs(pos(a1) - pos(a2))`, gdzie `a1` i `a2`, to elementy ciągu, o takiej samej wartości.

Wyznacz wartość elementów ciągu, między którymi jest zachowany największy bezpieczny dystans.

### Zadanie 4

Dla każdej możliwej wartości elementów wyznacz sumę bezpiecznych dystansów między każdymi dwoma elementami o tej wartości.


### Zadanie 5

Spójny podciąg niemalejący, to taki fragment ciągu, w którym kolejne elementy rosną lub są sobie równe. Znajdź długość i początek najdłuższego takiego podciągu. 

Jeśli istenieje ich wiele, wypisz ten, który zaczyna się największą liczbą. Jeżeli takich też istnieje wiele, to wypisz spośród tych zaczynających się największą liczbą ten, który występuje jako pierwszy.