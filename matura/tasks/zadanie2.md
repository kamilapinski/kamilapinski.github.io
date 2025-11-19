W pliku `punkty.txt` znajduje się `1000` wierszy. W każdym wierszu znajduje się para liczb oddzielona spacjąs, które oznaczają współrzędne punktu.

### Zadanie 0

Napisz funkcję, która wczytuje punkty z pliku, a następnie zwraca listę tych punktów, których odległość od punktu `(0, 0)` jest liczbą całkowitą.

Wszystkie poniższe zadania dotyczą właśnie tych punktów, których odległość od punktu `(0, 0)` jest liczbą całkowitą. Resztę punktów pomijamy.

### Zadanie 1

Wypisz wszystkie punkty, które się powtórzyły.

Wynik zapisz w pliku `punkty_odp_1.txt`.

### Zadanie 2

Przyjmijmy, że dla punktów `A` i `B`, `NWD(A, B) = NWD(|OA|, |OB|)`, gdzie `O` jest punktem `(0, 0)`. Zatem `NWD(A, B)` jest największym wspólnym dzielnikiem odległości punktu `A` od środka układu współrzędnych i odległości punktu `B` od środka układu współrzędnych.

Największa odległość punktu od środka dla danych z pliku `punkty.txt` jest niewiększa niż `50`.

Dla każdej możliwej odległości wypisz do pliku `punkty_odp_2.txt` ile par punktów ma `NWD` równe tej odległości.

### Zadanie 3

**Dzielnym podciągiem** punktów nazwiemy taki podciąg `a_1, a_2, ..., a_k`, że `NWD(a_1, a_2) <= NWD(a_2, a_3) <= ... <= NWD(a_k-1, a_k)`.

Znajdź pierwszy najdłuższy spójny dzielny podciąg punktów. Wypisz jego początek i długość.

Wynik zapisz w pliku `punkty_odp_3.txt`.

### Zadanie 4

Powiedzmy, że te punkty, to kolejne punkty, w których znalazł się helikopter.

**Płaskim przelotem** nazwiemy taki przelot pomiędzy dwoma sąsiednimi punktami, którego kąt względem osi X mieści się w przedziale `[-45deg, 45deg]`.

Na przykład dla punktów `A(0, 0)` i `B(10, 10)` przelot pomiędzy `A` i `B` jest płaski, ponieważ kąt pomiędzy prostą `AB`, a osią X jest równy `45deg`.

Znajdź łączną sumę płaskich przelotów (czyli sumę odcinków, w których był płaski przelot).

Wynik zapisz w pliku `punkty_odp_4.txt`.

### Zadanie 5

Znajdź najdłuższy spójny podciąg płaskich przelotów.

Początek i długość tego podciągu zapisz w pliku `punkty_odp_5_txt`.